# Binance Kripto Para İzleme Sistemi - Proje Planı

## 📋 Proje Özeti

Binance API kullanarak aktif USDT çiftlerindeki kripto varlıkları gerçek zamanlı olarak izleyen, teknik analiz verileri sunan web uygulaması ve Telegram botu.

## 🎯 Hedefler

### Ana Hedefler
1. **Web Uygulaması**: Kullanıcı dostu, gerçek zamanlı kripto veri izleme paneli
2. **Telegram Bot**: Mobil erişim için bot versiyonu
3. **Teknik Analiz**: RSI, Stochastic RSI ve BTC trend analizi

### Gösterilecek Veriler
- ✅ Coin Adı (Kripto varlık ismi)
- ✅ Drop Value (% düşüş değeri)
- ✅ Current Price (Anlık fiyat)
- ✅ Previous Price (Önceki fiyat)
- ✅ Volume (Hacim ve % değişimi)
- ✅ RSI (Relative Strength Index)
- ✅ Stochastic RSI
- ✅ BTC Status (Bitcoin trend durumu ve yorumu)

## 🏗️ Teknik Mimari

### Teknoloji Stack'i

#### Frontend (Web Uygulaması)
- **HTML5**: Yapısal içerik
- **Vanilla CSS**: Modern, glassmorphism tasarım
- **JavaScript (Vanilla)**: Gerçek zamanlı veri işleme
- **WebSocket**: Canlı fiyat güncellemeleri

#### Backend
- **Node.js + Express**: API sunucusu
- **Binance API**: Kripto veri kaynağı
  - REST API: Genel veriler
  - WebSocket API: Gerçek zamanlı fiyatlar

#### Telegram Bot
- **Node.js**: Bot mantığı
- **node-telegram-bot-api**: Telegram entegrasyonu
- Backend ile aynı servisler paylaşılacak

#### Veri İşleme
- **Technical Indicators (ta-lib veya tulind)**: RSI, Stochastic hesaplama
- **Custom Analysis**: BTC trend analizi

## 📊 Binance API Kullanımı

### Gerekli API Endpoint'leri

1. **24hr Ticker Price Change Statistics**
   ```
   GET /api/v3/ticker/24hr
   ```
   - Kullanım: Drop value, volume, previous/current price

2. **Kline/Candlestick Data**
   ```
   GET /api/v3/klines
   ```
   - Kullanım: RSI ve Stochastic RSI hesaplama
   - Parametreler: symbol, interval (1h, 4h, 1d)

3. **WebSocket Stream**
   ```
   wss://stream.binance.com:9443/ws/!ticker@arr
   ```
   - Kullanım: Tüm coinlerin gerçek zamanlı fiyat güncellemeleri

### API Key Kullanımı
- Çoğu endpoint için API key gerekmez (public data)
- Rate limiting: 1200 request/minute
- Güvenlik: API key'i backend'de sakla (frontend'e açma)

## 🎨 UI/UX Tasarımı

### Ana Özellikler
1. **Dashboard Layout**
   - Üst panel: BTC durumu ve genel piyasa özeti
   - Ana tablo: Tüm USDT çiftleri
   - Filtreleme: Drop value, volume, RSI bazlı

2. **Görsel Tasarım**
   - Dark mode (koyu tema)
   - Gradient arka planlar
   - Kartlar için glassmorphism efekti
   - Renk kodlaması:
     - 🟢 Yeşil: Yükseliş, RSI < 30 (oversold)
     - 🔴 Kırmızı: Düşüş, RSI > 70 (overbought)
     - 🟡 Sarı: Nötr bölge

3. **Animasyonlar**
   - Fiyat değişimlerinde smooth transition
   - Hover efektleri
   - Loading skeletons

4. **Responsive Design**
   - Desktop, tablet, mobile uyumlu

## 📁 Proje Yapısı

```
APIC/
├── backend/
│   ├── server.js                 # Ana server dosyası
│   ├── config/
│   │   └── binance.config.js     # API ayarları
│   ├── services/
│   │   ├── binance.service.js    # Binance API çağrıları
│   │   ├── technical.service.js  # RSI, Stochastic hesaplama
│   │   └── analysis.service.js   # BTC trend analizi
│   ├── utils/
│   │   └── cache.js              # Veri önbellekleme
│   └── package.json
│
├── frontend/
│   ├── index.html                # Ana sayfa
│   ├── css/
│   │   ├── style.css             # Ana stil dosyası
│   │   └── components.css        # Bileşen stilleri
│   ├── js/
│   │   ├── app.js                # Ana uygulama mantığı
│   │   ├── api.js                # Backend API çağrıları
│   │   ├── websocket.js          # WebSocket yönetimi
│   │   └── components/
│   │       ├── table.js          # Coin tablosu
│   │       └── btc-status.js     # BTC durum kartı
│   └── assets/
│       └── icons/                # SVG ikonlar
│
├── telegram-bot/
│   ├── bot.js                    # Bot ana dosyası
│   ├── commands/
│   │   ├── start.js
│   │   ├── coins.js
│   │   └── analyze.js
│   └── package.json
│
├── shared/
│   └── constants.js              # Ortak sabitler
│
├── .env.example                  # Çevre değişkenleri örneği
├── .gitignore
└── README.md
```

## 🔧 Teknik Detaylar

### RSI Hesaplama
```javascript
// 14 periyotluk RSI
// Formül: RSI = 100 - (100 / (1 + RS))
// RS = Ortalama Kazanç / Ortalama Kayıp
```

### Stochastic RSI Hesaplama
```javascript
// RSI'ın min-max normalize edilmiş hali
// StochRSI = (RSI - Min(RSI)) / (Max(RSI) - Min(RSI))
```

### BTC Trend Analizi
```javascript
// Faktörler:
// 1. Son 1 saatlik fiyat değişimi
// 2. RSI değeri
// 3. 7-14 günlük hareketli ortalama
// 4. Volume trend
// 
// Çıktı: "GÜÇLÜ YÜKSELİŞ", "YÜKSELİŞ", "NÖTR", "DÜŞÜŞ", "GÜÇLÜ DÜŞÜŞ"
```

## 📋 Geliştirme Fazları

### Faz 1: Backend Temeli (1-2 gün)
- [x] Node.js + Express kurulumu
- [x] Binance API entegrasyonu
- [x] Temel endpoint'ler (/api/coins, /api/btc-status)
- [x] WebSocket bağlantısı
- [x] Teknik gösterge hesaplama servisleri

### Faz 2: Frontend Geliştirme (2-3 gün)
- [x] HTML yapısı ve responsive tasarım
- [x] CSS ile modern arayüz (glassmorphism, dark mode)
- [x] JavaScript ile veri çekme ve gösterme
- [x] Gerçek zamanlı güncelleme (WebSocket)
- [x] Filtreleme ve sıralama özellikleri

### Faz 3: Analiz ve Optimizasyon (1-2 gün)
- [x] BTC trend algoritması geliştirme
- [x] Performans optimizasyonu
- [x] Caching mekanizması
- [x] Error handling ve logging

### Faz 4: Telegram Bot (2 gün)
- [x] Bot kurulumu
- [x] Komutlar (/start, /coins, /analyze)
- [x] Backend servisleri ile entegrasyon
- [x] Inline keyboard ve formatlı mesajlar

### Faz 5: Test ve Deploy (1 gün)
- [x] Test senaryoları
- [x] Bug fixing
- [x] Production deployment

**Toplam Tahmini Süre: 7-10 gün**

## 🚀 Hızlı Başlangıç (Quick Start)

### Gereksinimler
```bash
- Node.js 18+ 
- npm veya yarn
- Binance API Key (opsiyonel, public data için gerekli değil)
- Telegram Bot Token (bot için)
```

### Kurulum Adımları
```bash
# 1. Proje klonlama/oluşturma
cd Y:\APIC

# 2. Backend kurulum
cd backend
npm install

# 3. Frontend (static, kurulum gerekmez)
# Sadece browser'da aç: frontend/index.html

# 4. Telegram bot kurulum
cd ../telegram-bot
npm install

# 5. Çevre değişkenlerini ayarla
# .env dosyası oluştur ve API bilgilerini gir
```

## 🔐 Güvenlik

### Önemli Notlar
1. **API Key Güvenliği**
   - API key'i asla frontend kodunda kullanma
   - .env dosyasında sakla
   - .gitignore'a ekle
   - Sadece READ izni olan key kullan

2. **Rate Limiting**
   - Binance API limitlerini aşma
   - Caching kullan
   - Request throttling uygula

3. **CORS Ayarları**
   - Backend'de uygun CORS politikası

## 📈 İleri Seviye Özellikler (Opsiyonel)

### Gelecek Geliştirmeler
1. ⭐ **Alarm Sistemi**
   - Fiyat, RSI bazlı alarmlar
   - E-posta/Telegram bildirimleri

2. 📊 **Grafik Desteği**
   - Chart.js ile fiyat grafikleri
   - Teknik gösterge overlayleri

3. 💾 **Veri Saklama**
   - MongoDB/PostgreSQL entegrasyonu
   - Geçmiş veri analizi

4. 🤖 **AI Tahminleme**
   - Machine learning modelleri
   - Fiyat tahmin algoritmaları

5. 📱 **Mobil Uygulama**
   - React Native veya Flutter

## 🎯 Başarı Kriterleri

- ✅ Tüm USDT çiftlerini gerçek zamanlı gösterme
- ✅ Doğru RSI ve Stochastic RSI hesaplama
- ✅ BTC trend analizi accuracy > %70
- ✅ Sayfa yüklenme süresi < 3 saniye
- ✅ WebSocket ile 1 saniyede veri güncelleme
- ✅ Telegram bot response time < 2 saniye
- ✅ Mobile responsive tasarım

## 📞 Destek ve Kaynaklar

### API Dokümantasyonu
- [Binance API Docs](https://binance-docs.github.io/apidocs/spot/en/)
- [Binance WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)

### Teknik Göstergeler
- [RSI Calculator](https://www.investopedia.com/terms/r/rsi.asp)
- [Stochastic RSI](https://www.investopedia.com/terms/s/stochrsi.asp)

---

## ⚡ Hemen Başlayalım!

Projeyi şimdi başlatıyorum. İlk olarak backend altyapısını kuracağım, ardından frontend'i geliştireceğiz. Hazır olduğumuzda Telegram bot'a geçeceğiz.

**İlk Adım**: Backend yapısını oluşturma ve Binance API entegrasyonu.
