#!/usr/bin/python3
import json
import os
import requests
import ssl
from http.server import BaseHTTPRequestHandler, HTTPServer

storageMap = {}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith('/download'): return
        key = self.path.split("/")[-1]
        if key not in storageMap: return
        self.send_response(200)
        self.send_header('Content-type','application/octet-stream')
        self.end_headers()
        self.wfile.write(storageMap[key])

    def do_POST(self):
        if not self.path.startswith('/upload'): return
        content_len = int(self.headers.get('content-length', 0))
        # TODO: add content length limit
        post_body = self.rfile.read(content_len)
        key = self.path.split("/")[-1]
        storageMap[key] = post_body
        self.send_response(200)
        self.send_header('Content-type','application/octet-stream')
        self.end_headers()
        message = f"uploaded {key}\n"
        self.wfile.write(bytes(message, "utf8"))

def get_ssl_context(certfile, keyfile):
    context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
    context.load_cert_chain(certfile, keyfile)
    context.set_ciphers("@SECLEVEL=1:ALL")
    return context

with HTTPServer(('', 8447), handler) as server:
    context = get_ssl_context('simpleSignalProxy_cert.pem', 'simpleSignalProxy_key.pem')
    server.socket = context.wrap_socket(server.socket, server_side=True)
    server.serve_forever()
