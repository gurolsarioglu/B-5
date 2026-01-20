# 🚀 Binance Crypto Monitor

Binance API kullanarak kripto para piyasalarını gerçek zamanlı izleme sistemi. USDT çiftlerindeki coinlerin fiyat, hacim ve teknik göstergelerini (RSI, Stochastic RSI) takip edin.

## 📸 Özellikler

✅ **Gerçek Zamanlı Veri** - Binance API'den canlı kripto verileri  
✅ **Teknik Analiz** - RSI, Stochastic RSI, SMA, EMA hesaplamaları  
✅ **BTC Trend Analizi** - Bitcoin piyasa durumu ve AI destekli yorum  
✅ **Modern Arayüz** - Glassmorphism, dark mode, smooth animasyonlar  
✅ **Filtreleme & Sıralama** - Hacim, fiyat, RSI bazlı filtreleme  
✅ **Grid & Table View** - İki farklı görünüm modu  
✅ **Responsive Tasarım** - Mobil, tablet, desktop uyumlu  
✅ **Caching** - API limitlerini aşmamak için akıllı önbellekleme  

## 🛠️ Teknoloji Stack

### Backend
- **Node.js** + Express
- **Binance API** (REST + WebSocket)
- **Tulind** - Teknik gösterge kütüphanesi
- **Node-Cache** - Veri önbellekleme

### Frontend
- **HTML5** + **CSS3** + **Vanilla JavaScript**
- **Google Fonts** (Inter, JetBrains Mono)
- Modern CSS (Glassmorphism, Gradients, Animations)

## 📦 Kurulum

### Gereksinimler
```bash
- Node.js 18 veya üzeri
- npm veya yarn
```

### Adımlar

1. **Bağımlılıkları Yükle**
```bash
cd backend
npm install
```

2. **Environment Variables Ayarla**
```bash
# .env.example dosyasını kopyala
copy .env.example .env

# .env dosyasını düzenle (Binance API key opsiyonel - public data için gerekli değil)
```

3. **Backend'i Başlat**
```bash
# Development mode (nodemon ile)
npm run dev

# veya

# Production mode
npm start
```

Backend `http://localhost:3000` adresinde çalışacak.

4. **Frontend'i Aç**
```bash
# frontend/index.html dosyasını tarayıcıda aç
# veya
# Live Server kullanarak aç (VS Code extension)
```

## 🎯 Kullanım

### Web Arayüzü

1. Tarayıcıda `frontend/index.html` dosyasını açın
2. BTC trend analizi otomatik olarak yüklenecek
3. Top 50 USDT çifti görüntülenecek
4. Filtreleme, sıralama ve arama özellikleriyle coinleri inceleyin
5. Bir coine tıklayarak detaylı bilgilere ulaşın

### API Endpoints

#### Temel Endpoints
```bash
GET /api/health                    # Sunucu durumu
GET /api/coins                     # Tüm USDT çiftleri
GET /api/coins/:symbol             # Belirli bir coin detayı
GET /api/coins-with-indicators     # Teknik göstergeli coinler
GET /api/btc-status                # BTC trend analizi
GET /api/top-drops?limit=10        # En çok düşenler
GET /api/top-volume?limit=10       # En yüksek hacimli coinler
```

#### Cache Yönetimi
```bash
GET /api/cache/stats               # Cache istatistikleri
DELETE /api/cache                  # Cache'i temizle
```

### Örnek API Kullanımı

```javascript
// BTC durumunu al
fetch('http://localhost:3000/api/btc-status')
  .then(res => res.json())
  .then(data => console.log(data));

// Top 20 coini teknik göstergelerle al
fetch('http://localhost:3000/api/coins-with-indicators?limit=20')
  .then(res => res.json())
  .then(data => console.log(data));
```

## 📊 Veri Göstergeleri

Her coin için şu bilgiler gösterilir:

| Gösterge | Açıklama |
|----------|----------|
| **Coin Adı** | Kripto varlık ismi (ör: BTC, ETH) |
| **Current Price** | Anlık fiyat |
| **Previous Price** | 24 saat önceki fiyat |
| **Drop Value** | 24 saatlik değişim yüzdesi |
| **Volume** | 24 saat işlem hacmi (USDT) |
| **RSI** | 14 periyotluk Relative Strength Index |
| **Stochastic RSI** | Normalize edilmiş RSI |
| **BTC Status** | Bitcoin trend durumu ve analiz |

## 🎨 UI Özellikleri

- **Dark Mode** - Göz yormayan koyu tema
- **Glassmorphism** - Modern cam efekti kartlar
- **Smooth Animations** - Akıcı geçişler ve hover efektleri
- **Gradient Backgrounds** - Renkli gradient arka planlar
- **Status Colors** - Yeşil (yükseliş), Kırmızı (düşüş)
- **Responsive Design** - Tüm ekran boyutlarında çalışır

## ⚙️ Konfigürasyon

### Backend Config (`backend/config/binance.config.js`)

```javascript
RSI_PERIOD: 14              // RSI periyodu
STOCH_RSI_PERIOD: 14        // Stochastic RSI periyodu
KLINE_INTERVAL: '1h'        // Mum çubuğu aralığı
CACHE_TTL: 60               // Cache süresi (saniye)
```

### Frontend Config (`frontend/js/api.js`)

```javascript
API_BASE_URL: 'http://localhost:3000/api'  // Backend URL
```

## 🔐 Güvenlik ve Limitler

### Binance API Limits
- **Rate Limit**: 1200 requests/minute
- **Weight**: Her endpoint farklı weight'e sahip
- **Çözüm**: Caching kullanılarak API çağrıları minimize edilmiştir

### API Key Güvenliği
- API key **asla** frontend'de kullanılmaz
- Sadece backend `.env` dosyasında saklanır
- **READ-ONLY** API key kullanın (trade yetkisi vermeyin)
- Public endpoints için API key gerekmez

## 📱 Telegram Bot (Gelecek Geliştirme)

Telegram bot versiyonu için `telegram-bot/` klasöründe kod geliştirilecek:

```bash
├── telegram-bot/
│   ├── bot.js
│   ├── commands/
│   │   ├── start.js
│   │   ├── coins.js
│   │   └── analyze.js
│   └── package.json
```

## 🐛 Hata Giderme

### Backend Başlatılamıyor
```bash
# Port zaten kullanımda hatası
# Çözüm: .env dosyasında PORT değişkenini değiştir

PORT=3001  # farklı bir port kullan
```

### Tulind Kurulumu Başarısız
```bash
# Windows'ta build tools gerekebilir
npm install --global windows-build-tools

# Tekrar dene
npm install
```

### CORS Hatası
```bash
# Backend'de CORS açık (cors middleware)
# Farklı domain'den erişim için backend/server.js'te düzenle
```

## 📈 Performans

- **İlk Yükleme**: ~2-3 saniye
- **Cache Hit**: <100ms
- **API Response**: 200-500ms
- **Auto-Refresh**: 60 saniye

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

MIT License - Özgürce kullanabilirsiniz.

## 🙏 Teşekkürler

- **Binance** - API sağladığı için
- **Tulind** - Teknik gösterge kütüphanesi
- **Community** - Destek ve geri bildirim için

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

**Not**: Bu proje sadece bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir. Kripto para yatırımları risklidir, kendi araştırmanızı yapın.

🚀 **Happy Trading!**
