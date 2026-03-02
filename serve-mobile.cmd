@echo off
echo.
echo  Open on your phone (same WiFi): check your IP with ipconfig, then:
echo    http://YOUR_IP:8080
echo  Example: http://192.168.1.127:8080
echo  Press Ctrl+C to stop.
echo.
python -m http.server 8080 --bind 0.0.0.0
