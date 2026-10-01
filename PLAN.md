# Solaria — Şehre Güç Ver (Oyun Planı)

Web tabanlı, çok oyunculu (online), izometrik "diorama" görünümlü bir enerji/şehir kurma oyunu.
Referanslar: oynanış döngüsü için Roblox **Power a City**, kamera ve görsel hava için **My Dream Setup**
(yukarıdan-yandan 3/4 izometrik bakış, havada süzülen sevimli bir diorama ada).

---

## 1. Teknoloji Kararları

| Katman | Seçim | Neden |
|---|---|---|
| 3D Render | **Babylon.js** (`@babylonjs/core`) | Tam oyun motoru: hazır gölge, glow/bloom, parçacık sistemi, instancing, ortografik kamera, sahne optimizasyonu |
| İstemci paketleme | **Vite** | Hızlı geliştirme sunucusu, tek komutla build, Babylon'un ES modüllerini tree-shake eder |
| Sunucu | **Node.js + Express + Socket.IO** | Gerçek zamanlı oda/oyuncu senkronu, otomatik yeniden bağlanma |
| Ortak kod | `shared/` (saf JS) | Ekonomi, veri ve kurallar hem sunucuda hem istemcide aynı |
| Kayıt | JSON dosya deposu (`data/`) | Kurulumsuz; ileride SQLite/Mongo'ya taşınabilir |

**Neden yalnızca Babylon.js:** three.js ile Babylon.js'i aynı oyunda birlikte kullanmak iki ayrı WebGL bağlamı, iki kat
paket boyutu ve çakışan sahne yönetimi demek. Babylon.js bir oyun motoru olarak ihtiyacımız olan her şeyi (gölgeler,
GlowLayer, ParticleSystem, thin instance, animasyon, pointer/picking) tek pakette veriyor. Oyun mantığı (`shared/`) ve
sunucu render motorundan bağımsız; render kodu sadece `client/src/render/` içinde.

**Sunucu otoriter:** Para, satın alma, yerleştirme, nüfus — her şey sunucuda hesaplanır ve doğrulanır.
İstemci sadece gösterir ve istek gönderir (hile koruması).

---

## 2. Oyun Döngüsü (Power a City tarzı)

```
Jeneratör satın al → adana yerleştir → şehre elektrik ver → saniyede para kazan
        ↑                                                         ↓
  daha güçlü jeneratör  ←  şehir merkezlerini büyüt → daha çok insan → daha çok talep
```

- **Gelir** = şehre verilen elektrik (`min(arz, talep)`) × elektrik fiyatı × çarpanlar.
- **Arz > talep** → fazla elektrik boşa gider → şehri büyütmen gerekir.
- **Talep > arz** → karartma, nüfus azalır → daha fazla jeneratör gerekir.
- Şehir büyüdükçe talep, talep büyüdükçe saniyelik gelir artar.
- Alan sınırlı: eski jeneratörleri satıp (yüzde 50 iade) yerine daha güçlülerini koyarsın, ya da yükseltirsin.

### 2.1 Çevre koşulları
- **Gece/gündüz döngüsü (6 dk):** Güneş santralleri gece neredeyse hiç üretmez. Gece şehrin ışıkları yanar.
- **Rüzgar:** Sürekli değişen rüzgar şiddeti (%40–%160) rüzgar türbinlerini etkiler.
- **Kirlilik:** Fosil yakıtlar (kömür, petrol, doğalgaz, biraz da biyokütle) hava kalitesini düşürür →
  nüfus kapasitesi ve büyüme hızı azalır. Park merkezi bunu hafifletir.
- **Yakıt gideri:** Fosil santraller ucuz ve güçlüdür ama her saniye yakıt parası yer.

---

## 3. Enerji Kategorileri (10 kategori × 6–7 birim = 63 jeneratör)

| Kategori | Özellik | Örnek birimler |
|---|---|---|
| ☀️ Güneş | Temiz, gündüz çok güçlü, gece ~0 | Küçük Panel → Panel Dizisi → Güneş Çiftliği → Parabolik Oluk → Çanak Stirling → Güneş Kulesi (CSP) → Yörünge Alıcısı |
| 🌬️ Rüzgar | Temiz, rüzgara bağlı | Mini Türbin → Dikey Eksen → Rüzgar Türbini → Büyük Türbin → Açık Deniz Türbini → Mega Türbin |
| 💧 Hidro | Temiz, sabit | Su Çarkı → Mikro Hidro → Nehir Santrali → Dalga Enerjisi → Gelgit Santrali → Büyük Baraj |
| 🌋 Jeotermal (Termal) | Temiz, sabit, pahalı | Isı Pompası → Jeotermal Kuyu → Kuru Buhar → Flaş Buhar → Binary Çevrim → Magma Santrali |
| 🌿 Biyokütle | Az kirlilik, ucuz | Biyogaz Tankı → Kompost Jeneratörü → Pelet Santrali → Atıktan Enerji → Alg Biyoreaktörü → Biyokütle Kompleksi |
| ⛏️ Kömür | Çok güçlü, çok kirli, yakıt gideri | Küçük Kazan → Kömür Jeneratörü → Kömür Santrali → Akışkan Yatak → Süper Kritik → Ultra Süper Kritik |
| 🛢️ Petrol | Çok güçlü, kirli, yüksek yakıt gideri | Dizel Jeneratör → Petrol Pompası → Sondaj Kulesi → Fuel-Oil Santrali → Rafineri Santrali → Açık Deniz Platformu |
| 🔥 Doğalgaz | Güçlü, orta kirlilik | Gaz Jeneratörü → Gaz Türbini → Kombine Çevrim → LNG Terminali → Kojenerasyon → Mega Kombine Çevrim |
| ☢️ Nükleer | Devasa güç, temiz, pahalı | RTG → Mikro Reaktör → SMR → Basınçlı Su Reaktörü → Hızlı Üretken → Toryum Reaktörü → Nükleer Kompleks |
| 🚀 Füzyon & Gelecek | Oyun sonu | Füzyon Prototipi → Tokamak → Stellarator → Antimadde → Sıfır Noktası → Dyson Işın Alıcısı → Kara Delik Jeneratörü |

- Her jeneratörün: **maliyet, güç (kW), boyut (1×1 … 4×4), kirlilik, yakıt gideri** değerleri var.
- Her yerleştirilen jeneratör **5 seviyeye** kadar yükseltilebilir (yer kazandırır).
- Fiyat/güç değerleri tek bir kademe (tier) formülünden üretilir → dengelemesi kolay.

---

## 4. Şehir Merkezleri (talep tarafı)

Şehir adanın ortasında (10×10 karo). 8 merkez binası var, her biri seviye atladıkça görsel olarak da büyür:

| Merkez | Etki | Açılma |
|---|---|---|
| 🏠 Konut Merkezi | + nüfus kapasitesi (ana büyüme) | Baştan |
| 🏬 Ticaret Merkezi | + elektrik satış fiyatı (gelir çarpanı) | Baştan |
| 🌳 Park & Yeşil Alan | − kirlilik etkisi | Baştan |
| 🏭 Sanayi Merkezi | + kişi başı elektrik talebi | Kasaba |
| 🏥 Sağlık Merkezi | + büyüme hızı, + kapasite | Kasaba |
| 🎓 Eğitim & Ar-Ge | + tüm jeneratör gücü | İlçe |
| 🏟️ Eğlence Merkezi | + nüfus kapasitesi çarpanı | İlçe |
| ✈️ Ulaşım Merkezi | + kapasite ve büyüme hızı | Şehir |

**Şehir seviyeleri (nüfusa göre):** Köy → Kasaba (200) → İlçe (2.000) → Şehir (20.000) → Büyük Şehir (200.000) →
Metropol (2 milyon) → Megakent (20 milyon) → Ekümenopolis (200 milyon) → Gezegen Başkenti (2 milyar).
Seviye arttıkça binalar evden apartmana, apartmandan gökdelene dönüşür.

**Arazi genişletme:** Ada 30×30; başlangıçta merkeze yakın halka açık, 3 kademe arazi satın alınarak tüm ada açılır.

**Yeniden Doğuş (Rebirth):** Belirli nüfusa ulaşınca her şey sıfırlanır, kalıcı gelir çarpanı kazanılır (×2, ×3, …).

**Çevrimdışı kazanç:** Oyundan çıkınca son gelirin %50'si (en fazla 8 saat) birikir.

---

## 5. Online (Çok Oyunculu) Yapı

- Oyuncu takma ad + renk seçip girer; tarayıcıda gizli bir anahtar saklanır → ilerleme sunucuda kaydedilir.
- **Sunucu odaları:** Her odada 6 ada (Roblox sunucusu gibi). Oyuncu boş adaya yerleşir.
- Herkes diğer oyuncuların adalarını, jeneratörlerini ve şehirlerini canlı görür; kameranla gezebilirsin.
- **Liderlik tablosu** (saniyelik gelir, nüfus, toplam güç) ve **oda sohbeti**.
- Socket.IO olayları: `join`, `build`, `sell`, `upgrade`, `upgradeCenter`, `buyLand`, `rebirth`, `chat` (istemci→sunucu);
  `welcome`, `tick`, `plot`, `board`, `chat`, `joined/left` (sunucu→istemci).
- Sunucu 2 Hz ile ekonomiyi simüle eder, 30 sn'de bir ve çıkışta kaydeder.

---

## 6. Görsel Tasarım (My Dream Setup havası)

- **Ortografik izometrik kamera:** 45° açı, Q/E ile 90° döndürme, tekerlek ile yakınlaştırma, sürükleyerek/WASD ile kaydırma.
- **Havada süzülen adalar:** çimen üst yüzey, toprak ve kaya katmanları, altında bulutlar; yumuşak pastel renkler.
- **Prosedürel low-poly modeller:** 63 jeneratörün hepsi koddan üretilir (harici model dosyası yok):
  dönen türbin kanatları, sallanan petrol pompaları, bacadan çıkan duman, soğutma kulesi buharı,
  parlayan reaktörler, dönen füzyon halkaları…
- **Canlı şehir:** nüfusa göre dolan binalar, gece yanan pencereler, yollarda arabalar.
- **Enerji akışı:** üretim yapan santrallerden şehre akan parıltı parçacıkları.
- Gece/gündüz ışık geçişi, gölgeler, inşa sırasında yeşil/kırmızı "hayalet" önizleme.

---

## 7. Klasör Yapısı

```
shared/            Ortak oyun verisi ve kuralları (sunucu + istemci)
  data/            kategoriler, jeneratörler, merkezler
  economy.js       arz/talep/gelir/nüfus simülasyonu
  grid.js          ada ızgarası, arazi, yerleştirme kuralları
  env.js           gece/gündüz ve rüzgar
  format.js        sayı/para biçimlendirme
server/            Express + Socket.IO sunucusu, odalar, kayıt
client/            Vite + Babylon.js istemcisi
  src/render/      sahne, kamera, ada, şehir, modeller, efektler
  src/ui/          HUD, mağaza, şehir paneli, sohbet, liderlik
tests/             ekonomi ve ızgara birim testleri + denge simülasyonu
```

---

## 8. Yol Haritası

- [x] **Faz 0 — Plan & iskelet:** bu belge, proje yapısı, npm betikleri
- [x] **Faz 1 — Ortak çekirdek:** 63 jeneratör, 8 merkez, ekonomi formülleri, yerleştirme kuralları, testler, denge simülasyonu
- [x] **Faz 2 — Sunucu:** odalar, oyuncu kimliği, eylem doğrulama, tick döngüsü, kayıt, çevrimdışı kazanç, sohbet, liderlik
- [x] **Faz 3 — 3D dünya:** izometrik kamera, adalar, gece/gündüz, 63 prosedürel model, şehir ve animasyonlar
- [x] **Faz 4 — Arayüz:** giriş ekranı, HUD, mağaza, şehir paneli, seçim paneli, sohbet, liderlik, bildirimler
- [x] **Faz 5 — Cilalama:** parçacık efektleri, sesler, dokunmatik kontroller, instancing + dondurma, taşıma, büyüme animasyonu
- [x] **Faz 6 — Yayın:** üretim build'i, Dockerfile, render.yaml, kurulum notları (README)

- [x] **Faz 7 — Gerçekçilik & cila:** günlük talep eğrisi, 🔋 Depolama kategorisi (7 birim), malzeme sistemi
  (metal/cam/su/cephe dokusu), post-processing (bloom, ACES, SSAO), gerçekçi zemin/ağaç/şelale/sokak lambası,
  ⚙️ ayarlar menüsü, ilk giriş eğitimi, ortam sesi, tek oyunculu modda zorluk (yapay zekâ adaları kaldırıldı)

### Denge (bot simülasyonu, `npm run balance`)
Kusursuz oynayan bot: Kasaba ~2 dk · İlçe ~5 dk · Şehir ~9 dk · Büyük Şehir ~15 dk · Metropol / ilk yeniden doğuş ~31 dk ·
Gezegen Başkenti ~3,5 sa. Gerçek oyuncular için bu sürelerin kabaca 2-3 katı beklenir.

### Sonraki fikirler (Faz 8+)
- Hava olayları (fırtına, bulutlu gün), görevler/başarımlar, günlük ödüller
- Oyuncular arası elektrik ticareti, klanlar
- Kozmetik ada temaları
