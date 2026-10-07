#!/usr/bin/env python3
"""
Sirve el dashboard del gestor tecnico (React + Vite) en la Raspberry Pi y, ademas,
hace de portero de la API: las peticiones a /api/* y /uploads/* las reenvia al API
del gestor (por defecto http://127.0.0.1:3000).

Por que el portero:
  - El dashboard habla con la API por el MISMO origen (URL relativa), asi que no hay
    CORS ni direcciones grabadas a fuego: el mismo panel funciona por la IP de casa,
    por homeserve-pi.local y por el dominio publico de Cloudflare.
  - Fuera de casa no hay que publicar dos cosas distintas (panel y API): basta con
    publicar este puerto.

Diferencia con un servidor estatico normal: el dashboard usa rutas de navegador
(React Router: /clientes, /instalaciones, /ingenieria...). Si alguien abre o recarga
una de esas direcciones, el fichero no existe en disco y hay que devolver index.html
para que el propio dashboard resuelva la ruta. OJO: eso solo para rutas SIN extension;
un asset que no existe tiene que dar 404, no el index.html (el navegador recibiria
text/html donde espera un modulo y la pantalla se queda en blanco sin decir nada).

    python3 servidor_dashboard.py --puerto 8081
"""

import argparse
import http.client
import http.server
import json
import os
import sys
from urllib.parse import parse_qs, urlsplit

try:
    from puerta import DIAS_SESION as DIAS_SESION_PUERTA, Puerta
except ImportError:            # sin el modulo la puerta no existe, pero el panel funciona
    Puerta, DIAS_SESION_PUERTA = None, 1

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.join(AQUI, "dist")

# A donde se reenvia la API y que rutas son del API (y no ficheros del panel).
API = os.environ.get("API_DESTINO", "http://127.0.0.1:3000")
RUTAS_API = ("/api/", "/uploads/")
TIEMPO_ESPERA = 120
CABECERAS_PROPIAS = {
    # cabeceras de la conexion: no se copian al reenviar
    "host", "connection", "keep-alive", "transfer-encoding", "upgrade",
    "proxy-authenticate", "proxy-authorization", "te", "trailers", "content-length",
}

# Puerta de acceso con codigo al correo, solo para lo que llega de internet.
# Se apaga con PUERTA=no (cuando Cloudflare Access este puesto, para no pedir dos codigos).
PUERTA_ACTIVA = os.environ.get("PUERTA", "si").strip().lower() in ("si", "sí", "1", "yes", "true")
PUERTA = None
if PUERTA_ACTIVA and Puerta is not None:
    try:
        PUERTA = Puerta(
            fichero_correos=os.environ.get("PUERTA_CORREOS", os.path.join(AQUI, "puerta_correos.txt")),
            fichero_credenciales=os.environ.get(
                "PUERTA_CREDENCIALES", os.path.expanduser("~/.credenciales_correo.json")),
            fichero_secreto=os.environ.get("PUERTA_SECRETO", os.path.expanduser("~/.puerta_secreto")),
        )
    except Exception as error:
        print(f"AVISO: la puerta no se pudo preparar ({error}): el panel servira sin puerta", flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    # --- puerta de acceso -----------------------------------------------------
    def de_internet(self) -> bool:
        """Cloudflare anade estas cabeceras a todo lo que entra por el tunel."""
        return bool(self.headers.get("Cf-Connecting-Ip") or self.headers.get("Cf-Ray"))

    def pasa_puerta(self) -> bool:
        """True si puede seguir; False si ya se le ha respondido con la puerta."""
        if PUERTA is None or not self.de_internet():
            return True
        if self.sesion_puerta() or urlsplit(self.path).path.startswith("/puerta"):
            return True
        self.responder_puerta()
        return False

    def sesion_puerta(self):
        return PUERTA.sesion(self.headers.get("Cookie"))

    def responder_puerta(self):
        if urlsplit(self.path).path.startswith(RUTAS_API):
            cuerpo = json.dumps({"message": "Hace falta identificarse", "statusCode": 401}).encode()
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(cuerpo)
        else:
            self.responder_html(PUERTA.pagina_correo())

    def responder_html(self, cuerpo: bytes, estado: int = 200, extra=()):
        self.send_response(estado)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        for nombre, valor in extra:
            self.send_header(nombre, valor)
        self.end_headers()
        if estado != 204:
            self.wfile.write(cuerpo)

    def cookie_sesion(self, correo: str):
        trozos = [f"puerta_gestor={PUERTA.cookie(correo)}", "Path=/", "HttpOnly",
                  "SameSite=Lax", f"Max-Age={DIAS_SESION_PUERTA * 86400}"]
        if self.de_internet():
            trozos.append("Secure")     # por el tunel siempre es https
        return ("Set-Cookie", "; ".join(trozos))

    def atender_puerta(self, metodo: str):
        ruta = urlsplit(self.path).path
        if metodo == "GET":
            if ruta == "/puerta/salir":
                return self.responder_html(
                    PUERTA.pagina_correo("Has salido de la sesion."), 200,
                    [("Set-Cookie", "puerta_gestor=; Path=/; Max-Age=0")])
            return self.responder_html(PUERTA.pagina_correo())

        campos = parse_qs((self.leer_cuerpo() or b"").decode("utf-8", "replace"))
        correo = (campos.get("correo", [""])[0] or "").strip().lower()

        if ruta == "/puerta":
            if not PUERTA.permitido(correo):
                return self.responder_html(PUERTA.pagina_correo("Ese correo no esta autorizado para entrar."))
            if not PUERTA.puede_pedir(correo):
                return self.responder_html(PUERTA.pagina_correo(
                    "Has pedido demasiados codigos seguidos. Espera media hora."))
            codigo = PUERTA.emitir(correo)
            fallo = PUERTA.enviar(correo, codigo)
            if fallo:
                print(f"PUERTA: no pude enviar el codigo a {correo}: {fallo}", flush=True)
                return self.responder_html(PUERTA.pagina_correo(
                    "No he podido enviarte el correo. Avisa al administrador."))
            return self.responder_html(PUERTA.pagina_codigo(correo))

        if ruta == "/puerta/codigo":
            if PUERTA.comprobar(correo, campos.get("codigo", [""])[0]):
                self.send_response(303)
                self.send_header("Location", "/")
                self.send_header("Content-Length", "0")
                self.send_header(*self.cookie_sesion(correo))
                self.end_headers()
                return
            return self.responder_html(PUERTA.pagina_codigo(correo, "Codigo incorrecto o caducado."))

        self.send_error(404, "No existe")

    # --- portero hacia la API -------------------------------------------------
    @staticmethod
    def es_del_api(ruta: str) -> bool:
        return ruta.startswith(RUTAS_API)

    def leer_cuerpo(self):
        """Cuerpo de la peticion, venga con Content-Length o troceado (chunked).

        Cloudflare, al reenviar por el tunel, manda el cuerpo TROCEADO y sin Content-Length. Si solo
        se mira esa cabecera, el cuerpo se pierde y a la API le llega vacio: el login respondia
        "Hace falta identificarse" porque no le llegaban ni el email ni la contrasena, y lo mismo
        pasaba con cualquier guardado (alta de tramite, cliente, maquina...). Por la red local no se
        notaba, porque ahi el cuerpo siempre viaja con Content-Length.
        """
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            trozos = []
            while True:
                linea = self.rfile.readline(65536).strip()
                if not linea:
                    break
                try:
                    largo = int(linea.split(b";")[0], 16)
                except ValueError:
                    break
                if largo == 0:
                    self.rfile.readline(65536)      # CRLF que cierra el cuerpo
                    break
                trozos.append(self.rfile.read(largo))
                self.rfile.readline(65536)          # CRLF que cierra el trozo
            return b"".join(trozos) or None

        longitud = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(longitud) if longitud else None

    def reenviar(self, metodo: str):
        cuerpo = self.leer_cuerpo()

        partes = urlsplit(API)
        conexion = http.client.HTTPConnection(
            partes.hostname, partes.port or 80, timeout=TIEMPO_ESPERA
        )
        cabeceras = {
            k: v for k, v in self.headers.items()
            if k.lower() not in CABECERAS_PROPIAS
        }
        cabeceras["X-Forwarded-For"] = self.client_address[0]
        cabeceras["X-Forwarded-Host"] = self.headers.get("Host", "")
        cabeceras["X-Forwarded-Proto"] = self.headers.get("X-Forwarded-Proto", "http")

        try:
            conexion.request(metodo, self.path, body=cuerpo, headers=cabeceras)
            respuesta = conexion.getresponse()
            datos = respuesta.read()
            estado, cabeceras_resp = respuesta.status, respuesta.getheaders()
        except Exception as error:              # API caida, puerto cerrado, timeout...
            self.send_error(502, f"El API del gestor no responde ({error})")
            return
        finally:
            conexion.close()

        self.send_response(estado)
        for nombre, valor in cabeceras_resp:
            if nombre.lower() in ("connection", "keep-alive", "transfer-encoding",
                                  "content-length", "date", "server"):
                continue
            self.send_header(nombre, valor)
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        if metodo != "HEAD":
            self.wfile.write(datos)

    # --- ficheros del panel ---------------------------------------------------
    def resolver_panel(self) -> bool:
        """Deja self.path apuntando al fichero correcto. False = ya se respondio error."""
        ruta = urlsplit(self.path).path
        fichero = os.path.normpath(os.path.join(RAIZ, ruta.lstrip("/")))
        if not fichero.startswith(RAIZ):
            self.send_error(404, "No existe")
            return False
        if not os.path.isfile(fichero):
            # Un fichero CON extension (assets/*.js, *.css, imagenes) que no existe NO
            # puede responder con el index.html: eso deja la pantalla en blanco sin
            # decir nada cada vez que se redespliega y un navegador pide el bundle viejo.
            if os.path.splitext(ruta)[1]:
                self.send_error(404, "No existe")
                return False
            # Ruta del dashboard (React Router: /ingenieria, /clientes...) -> index.html
            self.path = "/index.html"
        return True

    def do_GET(self):
        if not self.pasa_puerta():
            return
        if urlsplit(self.path).path.startswith("/puerta"):
            return self.atender_puerta("GET")
        if self.es_del_api(urlsplit(self.path).path):
            self.reenviar("GET")
        elif self.resolver_panel():
            super().do_GET()

    def do_HEAD(self):
        if not self.pasa_puerta():
            return
        if self.es_del_api(urlsplit(self.path).path):
            self.reenviar("HEAD")
        elif self.resolver_panel():
            super().do_HEAD()

    def do_POST(self):
        if not self.pasa_puerta():
            return
        if urlsplit(self.path).path.startswith("/puerta"):
            return self.atender_puerta("POST")
        self.reenviar("POST")

    def do_PUT(self):
        if not self.pasa_puerta():
            return
        self.reenviar("PUT")

    def do_PATCH(self):
        if not self.pasa_puerta():
            return
        self.reenviar("PATCH")

    def do_DELETE(self):
        if not self.pasa_puerta():
            return
        self.reenviar("DELETE")

    def do_OPTIONS(self):
        # Mismo origen: el navegador no deberia preguntar. Si pregunta, se responde aqui.
        self.send_response(204)
        self.send_header("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def end_headers(self):
        # El index, sin cache: asi un despliegue nuevo se ve al instante (y el index
        # apunta a un bundle con nombre nuevo, que tambien se descarga).
        if self.path.startswith("/index.html") or self.path == "/":
            self.send_header("Cache-Control", "no-store")
        # Los assets llevan el hash en el nombre: si existe, es inmutable. Nunca se
        # cachea un 404 (un asset que hoy no esta podria volver, y un 404 cacheado
        # dejaria el panel roto para siempre en ese navegador).
        elif self.path.startswith("/assets/") and os.path.isfile(
            os.path.normpath(os.path.join(RAIZ, self.path.lstrip("/")))
        ):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, formato, *args):
        # silencio: solo interesan los errores, y los escribe systemd
        pass


def main():
    p = argparse.ArgumentParser(description="Servidor del dashboard del gestor tecnico")
    p.add_argument("--puerto", type=int, default=8081)
    a = p.parse_args()

    if not os.path.isdir(RAIZ):
        sys.exit(f"No encuentro {RAIZ}. Falta compilar el dashboard (npm run build).")

    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", a.puerto), Handler) as s:
        print(f"Dashboard del gestor tecnico en http://0.0.0.0:{a.puerto}/  (dist: {RAIZ})", flush=True)
        print(f"API reenviada a {API}  (rutas {', '.join(RUTAS_API)})", flush=True)
        s.serve_forever()


if __name__ == "__main__":
    main()
