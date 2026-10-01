# ☀️ Solaria — Şehre Güç Ver

Tarayıcıda oynanan, **çok oyunculu (online)**, izometrik "diorama" görünümlü enerji ve şehir kurma oyunu.
Adana santraller kur, şehrine elektrik ver, merkezlerini büyüt, daha çok insan çek, daha çok kazan!

- 🎮 Oynanış ilhamı: Roblox **Power a City** · 🎨 Görsel ilham: **My Dream Setup**
- 🧱 Motor: **Babylon.js** (render) · **Socket.IO** (gerçek zamanlı sunucu) · **Vite** (paketleme)
- 📋 Tasarım ve yol haritası: [PLAN.md](PLAN.md)

## Özellikler

- **10 enerji kategorisi, 63 santral:** Güneş, Rüzgar, Hidro, Biyokütle, Kömür, Petrol, Doğalgaz, Jeotermal,
  Nükleer, Füzyon & Gelecek — her birinde 6-7 birim, hepsi koddan üretilmiş animasyonlu low-poly 3D modeller.
- **Arz–talep ekonomisi:** Şehre verdiğin her kW saniyede para kazandırır. Fazla elektrik boşa gider, eksik elektrik
  karartma yapar ve insanlar şehri terk eder.
- **Büyüyen şehir:** 8 şehir merkezi (Konut, Ticaret, Park, Sanayi, Sağlık, Eğitim & Ar-Ge, Eğlence, Ulaşım).
  Köyden Gezegen Başkenti'ne 9 şehir seviyesi; evler apartmana, apartmanlar gökdelene dönüşür.
- **Canlı dünya:** Gece/gündüz döngüsü (güneş gece üretmez), sürekli değişen rüzgar, fosil yakıt kirliliği ve
  yakıt gideri, bacalardan duman, soğutma kulelerinden buhar, gece yanan pencereler, yollarda arabalar.
- **Online:** 6 adalık sunucu odaları, diğer oyuncuların adalarını canlı görme, oda sohbeti, oda ve tüm zamanlar
  liderlik tabloları, sunucu tarafında kayıt, çevrimdışı kazanç.
- **İlerleme:** Santral yükseltme (5 seviye), taşıma, satma, arazi genişletme, yeniden doğuş (kalıcı gelir çarpanı).

## Hızlı başlangıç

Gerekenler: **Node.js 20.19+** (veya 22+)

```bash
npm install
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini aç. (`dev` komutu oyun sunucusunu `:3000`'de, Vite'ı `:5173`'te başlatır.)

Arkadaşlarınla aynı ağda oynamak için Vite'ın yazdığı ağ adresini (ör. `http://192.168.1.20:5173`) paylaş.

### Üretim (tek sunucu)

```bash
npm run build     # istemciyi dist/ klasörüne derler
npm start         # http://localhost:3000 — hem oyunu hem Socket.IO'yu sunar
```

| Ortam değişkeni | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket portu |
| `DATA_DIR` | `./data` | Oyuncu kayıtlarının tutulduğu klasör |

### Docker

```bash
docker build -t solaria .
docker run -p 3000:3000 -v solaria-data:/app/data solaria
```

### İnternette yayınlama

Oyun tek bir Node.js süreci olduğu için WebSocket destekleyen her platformda çalışır:

- **Render.com:** Depoyu bağla → `render.yaml` otomatik algılanır (Blueprint). Kalıcı kayıt için diske ihtiyaç var
  (`render.yaml` içinde `disk` bölümü hazır; ücretli planlarda çalışır).
- **Railway / Fly.io:** Dockerfile ile doğrudan yayınlanır; `DATA_DIR` için bir volume bağla.

## Kontroller

| Eylem | Fare / Dokunmatik | Klavye |
|---|---|---|
| Kaydır | Sol tuşla sürükle / tek parmak | `W A S D` / ok tuşları |
| Döndür | Sağ tuşla sürükle / iki parmak çevir | `Q` `E` (90°) |
| Yakınlaştır | Tekerlek / iki parmak sıkıştır | `+` `-` |
| Santral kur | Mağazadan seç → adaya tıkla | `1`…`0` kategori |
| Yükselt / Taşı / Sat | Santrale tıkla → kart | `U` / `M` / `X` |
| İptal | Sağ tık | `Esc` |
| Paneller / Adama dön | Köşe düğmeleri | `B` `C` / `H` |

**Model galerisi:** `http://localhost:5173/?vitrin` tüm 63 santrali ve tam gelişmiş bir şehri tek adada gösterir
(sunucu gerekmez). `&saat=0.7` ile gece görünümü.

## Proje yapısı

```
shared/              Sunucu ve istemcinin ortak kullandığı saf oyun mantığı
  data/              kategoriler, 63 jeneratör, 8 merkez ve şehir seviyeleri
  balance.js         tüm denge sabitleri (tek yerden ayarla)
  economy.js         arz/talep/gelir/nüfus/kirlilik simülasyonu
  actions.js         inşa/sat/yükselt/taşı/merkez/arazi/yeniden doğuş (doğrulama + uygulama)
  grid.js env.js format.js
server/              Express + Socket.IO: odalar, kimlik, 2 Hz simülasyon, JSON kayıt
client/
  src/render/        Babylon.js: dünya, kamera, ada, şehir, efektler, model kiti
  src/render/models/ 63 santral + şehir binaları (prosedürel)
  src/ui/            HUD, mağaza, şehir paneli, inceleme kartı, sohbet, giriş
tests/               birim testleri ve denge simülasyonu
```

## Geliştirme

```bash
npm test          # ekonomi, ızgara ve eylem testleri
npm run balance   # bot ile ilerleme hızını ölç (ör. ilk yeniden doğuş kaç dakikada?)
```

Yeni bir santral eklemek için: `shared/data/generators.js` içine bir satır, `client/src/render/models/generators.js`
içine aynı `id` ile bir model fonksiyonu ekle. Fiyat ve güç kademe (tier) değerinden otomatik hesaplanır.

Sunucu otoriterdir: istemci yalnızca istek gönderir; para, yerleştirme ve tüm kurallar sunucuda `shared/actions.js`
ile doğrulanır.
