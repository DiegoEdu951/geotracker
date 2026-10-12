# ═══════════════════════════════════════════════════════════════
# GeoTracker — Instalación en Ubuntu (AWS EC2)
# Ejecuta estos comandos en orden dentro de tu instancia
# ═══════════════════════════════════════════════════════════════

# ── 1. Actualizar el sistema ───────────────────────────────────
sudo apt update && sudo apt upgrade -y

# ── 2. Instalar Node.js (v20 LTS) ─────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node -v    # debe mostrar v20.x.x
npm -v

# ── 3. Instalar Nginx ──────────────────────────────────────────
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ── 4. Instalar PM2 (mantiene Node.js corriendo siempre) ───────
sudo npm install -g pm2

# ── 5. Copiar los archivos del proyecto ───────────────────────
sudo mkdir -p /var/www/geotracker
sudo chown $USER:$USER /var/www/geotracker

# Si subes los archivos con scp desde tu PC:
#   scp -r ./geotracker ubuntu@TU_IP:/var/www/
# O clónalos si usas git:
#   git clone TU_REPO /var/www/geotracker

cd /var/www/geotracker
npm install

# ── 6. Arrancar el servidor con PM2 ───────────────────────────
pm2 start server.js --name geotracker
pm2 save                          # guarda para que arranque al reiniciar
pm2 startup                       # sigue las instrucciones que te muestre

# Comandos útiles de PM2:
#   pm2 status          → ver si está corriendo
#   pm2 logs geotracker → ver logs en vivo
#   pm2 restart geotracker

# ── 7. Configurar Nginx ────────────────────────────────────────
sudo cp /var/www/geotracker/nginx.conf /etc/nginx/sites-available/geotracker
sudo ln -s /etc/nginx/sites-available/geotracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # quitar el sitio por defecto
sudo nginx -t                                  # verificar configuración
sudo systemctl reload nginx

# ── 8. Abrir puertos en AWS (Security Group) ──────────────────
# En la consola de AWS → EC2 → Security Groups → tu instancia:
#   - Agrega regla: HTTP  puerto 80  origen 0.0.0.0/0
#   - Agrega regla: HTTPS puerto 443 origen 0.0.0.0/0
# El puerto 3000 NO debe estar abierto al exterior (Nginx lo maneja)

# ── 9. HTTPS gratuito con Let's Encrypt (opcional pero recomendado)
# Requiere tener un dominio apuntando a tu IP
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d TU_DOMINIO.com
# Certbot actualiza solo el nginx.conf con SSL
# Renovación automática ya viene configurada

# ── 10. Verificar que todo funciona ───────────────────────────
# Desde tu PC, en el navegador: http://TU_IP
# Debería aparecer el panel del mapa

# Test rápido de la API (reemplaza TU_IP):
curl -X POST http://TU_IP/api/location \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-1","device_name":"Mi celular","lat":-16.4090,"lng":-71.5375,"battery":0.85}'

# Respuesta esperada: {"ok":true}
# Luego refresca el mapa y debería aparecer el pin en Arequipa 🗺️
