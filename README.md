# Çekmece Stoku

Ofisteki çekmece stokunu takip eden mini web uygulaması. Admin şifre ile giriş yapıp ürün ekleyebilir; herkes stoku görüntüleyebilir.

## Kurulum

```bash
npm install
cp .env.example .env
# .env içinde ADMIN_PASSWORD, PORT ve isteğe bağlı HOST'u düzenleyin (HOST=0.0.0.0 ağdan erişim için)
# Kullanılacak portlar: 3009 (ana uygulama). İkinci bir servis gerekirse 3010 kullanın.
```

## Çalıştırma

```bash
ADMIN_PASSWORD=your_password node server.js
```

Veya `.env` kullanıyorsanız:

```bash
npm start
```

Tarayıcıda http://localhost:3009 adresine gidin. Admin girişi yapıp ürün ekleyebilirsiniz (görsel URL, ürün adı, miktar).
