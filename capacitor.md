## Crear aplicación (Android)

### Setup

Debemos tener instalado Android Studio / Android SDK.

En el proyecto, instalamos:

```bash
npm install @capacitor/core @capacitor/cli --save
npm install @capacitor/app

npx cap init "<app>" "systems.alexicon.<app>"
npx cap add android
```

Si sale un error con npx cap add android, hay que ejecutar:

```bash
npm install @capacitor/android
```

Y luego reintentamos el comando npx cap add android.

### Ciclo de desarrollo

Cada vez que hagamos cambios, o que hayamos terminado, ejecutamos:

```bash
npm run build && npx cap sync android && npx cap open android
```

Después, en android studio:

_Build > Generate App Bundles or APKs > Generate APKs_

Para publicar en PlayStore, necesitaremos AAB:

_Build > Generate Signed App Bundle / APK > Android App Bundle_