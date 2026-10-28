# Mobile app (Expo)

The React Native client: Projekty (with tasks), Czas, Wydatki, Liczniki and Konto — everything the web has except Notatki. Logic (API client, stores) comes from `@personal/shared`; this app only has the screens.

## Run on a phone

1. Install Expo Go on the phone; phone and computer on the same Wi-Fi.
2. `just install` (once, from the repository root).
3. `just backend-lan` — the API on `0.0.0.0:8000`, with this machine's LAN IP allowed.
   With a firewall (e.g. `ufw`) open the ports to the LAN first, or Expo Go fails with "Failed to download remote update":
   `sudo ufw allow from 192.168.0.0/16 to any port 8081,8000 proto tcp`
4. `just mobile` — scan the QR code with Expo Go (Android) or the Camera app (iOS).

The app talks to `http://<dev-server-host>:8000` by default. Set `EXPO_PUBLIC_API_URL` (e.g. `https://your-domain`) to point it elsewhere.

## Build an APK against the VPS

`just mobile-apk` builds an installable APK in the cloud with EAS Build (needs a free Expo account: `npx eas-cli login`). The app talks to `https://$DOMAIN`, with `DOMAIN` read from the root `.env`. `mobile/eas.json` keeps a `[[DOMAIN]]` placeholder, which the recipe fills only for the duration of the build and then restores. The address is compiled in, so changing it means a new build. It must be HTTPS, because release builds on Android block plain HTTP.

To build on this machine instead (no Expo account), run `just mobile-apk-local`. It runs `expo prebuild` and Gradle, and writes `mobile/djangopersonal.apk`. It needs the Android SDK (`ANDROID_HOME`, default `~/Android/Sdk`) and JDK 17 (`JAVA_HOME`). The APK is signed with the Expo template's debug key, which is fine for installing it yourself.

## Checks

- `npm run typecheck` — TypeScript.
- `npm run export` — bundles the app for Android and iOS (catches Metro resolution problems).
