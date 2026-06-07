# Cambio VES – PWA

App de tasas de cambio BCV Venezuela. Funciona online y offline.

---

## 🚀 Publicar en Vercel (paso a paso)

### Paso 1 – Subir el proyecto a GitHub

1. Ve a [github.com](https://github.com) y crea una cuenta si no tienes
2. Clic en **"New repository"** → nombre: `cambio-ves` → **Create repository**
3. Descarga e instala [GitHub Desktop](https://desktop.github.com/) (más fácil)
4. En GitHub Desktop: **File → Add Local Repository** → selecciona esta carpeta
5. Clic **"Publish repository"** → sube el proyecto

### Paso 2 – Desplegar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Clic **"Add New Project"**
3. Selecciona el repositorio `cambio-ves`
4. Vercel detecta Vite automáticamente → clic **Deploy**
5. En ~1 minuto tendrás una URL como: `https://cambio-ves.vercel.app`

### Paso 3 – Generar APK con PWA Builder

1. Ve a [pwabuilder.com](https://www.pwabuilder.com)
2. Pega la URL de Vercel → clic **Start**
3. PWA Builder analiza el manifest → clic **Package for stores**
4. Selecciona **Android** → clic **Generate**
5. Descarga el `.apk` → instálalo en tu Android

> ⚠️ Para instalar el APK en Android: ve a **Ajustes → Seguridad → Fuentes desconocidas** y actívalo.

---

## 💻 Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`

## 📦 Build para producción

```bash
npm run build
```

Los archivos quedan en `/dist`

---

## 📱 Características

- ✅ Tasas BCV: Dólar, Euro, USDT Binance, Intervención Digital
- ✅ Calculadora Bs ↔ USD
- ✅ Funciona sin internet (Service Worker + caché 12h)
- ✅ Compartir por WhatsApp, QR, enlace
- ✅ Enviar cotización formateada por WhatsApp
- ✅ Instalable como app en Android e iOS
