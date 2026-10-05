# Physical-device Vite testing

Development API requests use `http://<UI hostname>:8080`; the projector WebSocket
uses `ws://<UI hostname>:8080/projector/ws`. No machine IP is configured in source.
Production builds retain relative API URLs and same-origin WebSockets.

For the split Vite/Spring setup on a trusted LAN:

1. Restart the Mac backend with the **lan-dev** Spring profile. Keep your existing
   datasource, media and other startup arguments. For Maven, add
   `-Dspring-boot.run.profiles=lan-dev` to the existing `./mvnw spring-boot:run`
   command. For Java/JAR startup, add `--spring.profiles.active=lan-dev`.
2. Start Vite with `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`.
3. Open `http://<MAC-LAN-IP>:5173` on the phone. Refresh an already-open page.
4. Allow the phone to reach TCP 5173 and 8080 on the Mac; both devices must be on
   a LAN without client isolation. No firewall configuration is changed by this work.

The opt-in profile binds Spring to `0.0.0.0:8080` and permits cross-origin HTTP
requests and WebSocket handshakes from HTTP Vite origins on port **5173**.
The profile does not configure or replace data paths. Do not enable it for the
Windows production installation: production serves UI/API together on port 8080.
Without the profile, existing same-origin and localhost development rules remain.

Development assumes plain HTTP Spring on port 8080. HTTPS Vite requires a matching
TLS backend/proxy configuration; it is not introduced by this change.
