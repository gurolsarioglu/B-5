# RSI Çoklu Zaman Dilimi (Multi-Timeframe) Analizi Planı

## 📌 Hedef
15 dakikalık scalping botuna, işlemin güvenilirliğini artırmak için 1 Saatlik (1h), 4 Saatlik (4h) ve Günlük (1D) periyot verilerini ekleyerek büyük resmi görmek.

## 🛠️ Teknik Strateji
1. **Verimli Tarama:** Bot tüm coinleri 15 dakikalık periyotta taramaya devam edecek.
2. **Onay Mekanizması:** Sadece 15dk RSI seviyesi belirlediğimiz kriterlere (RSI <= 20 veya RSI >= 80) ulaştığında, bot o özel coin için üst periyot verilerini çekecek.
3. **Zaman Dilimleri:**
   - **15 Dakika:** Giriş sinyali tetikleyici.
   - **1 Saat:** Kısa vadeli trend onayı.
   - **4 Saat:** Ana trend yönü.
   - **1 Gün:** "Büyük Resim" ve uzun vadeli destek/direnç bölgesi.

## 📈 Mesaj Formatı Taslağı
Sinyal mesajı geldiğinde şu yapıda olacak:
- `📈 [15DK] #COIN ADI - BUY/SELL`
- `• Fiyat: [Anlık Fiyat]`
- `• 15dk RSI: [Değer] (Sinyal Noktası ⭐)`
- `• 1 Saatlik RSI: [Değer]`
- `• 4 Saatlik RSI: [Değer]`
- `• Günlük RSI: [Değer]`
- `• Hacim: [Hacim Durumu 🔥]`

## 🧠 Karar Verme Mantığı (Geliştirilecek)
- **Güçlü Dip:** Tüm periyotların (15m, 1h, 4h) aynı anda aşırı satım bölgesinde olması.
- **Trend Pullback:** 1 saatlik ve 4 saatlik RSI'ın güçlü (örneğin 60+) olduğu durumda 15 dakikalık RSI'ın 20 altına inmesi (Düzeltme alımı).
- **Riske Karşı Korunma:** Günlük RSI'ın aşırı şişik (80+) olduğu durumlarda gelen 15dk alım sinyallerine karşı temkinli olma.

## 📝 Notlar
- Üst periyot verileri sadece sinyal geldiğinde çekileceği için API limitlerini zorlamaz.
- Günlük veri filtre olarak değil, sadece bilgi amaçlı (Yön gösterici) olarak eklenecek.

---
*Bu dosya akşam evde yapılacak değerlendirme için hazırlanmıştır. (22.01.2026)*
