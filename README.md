# Anker Turbo Background Review

Chrome Extension (Manifest V3) hỗ trợ tự động hoá quy trình review task hàng loạt trên hệ thống Anker Annotation, chạy nhiều task song song trong các tab ẩn (background tabs).

## Mục lục
- [Tổng quan](#tổng-quan)
- [Chức năng chính](#chức-năng-chính)
- [Cấu trúc extension](#cấu-trúc-extension)
- [Cài đặt cấu hình (Popup)](#cài-đặt-cấu-hình-popup)
- [Cơ chế hoạt động](#cơ-chế-hoạt-động)
- [Self-heal & Persistence](#self-heal--persistence)

---

## Tổng quan

Extension gồm 3 lớp chính:
- **main.js** — chạy trong `MAIN world` của trang, đọc UI/API của web app, gắn nút điều khiển, phát hiện task lỗi/task trắng.
- **bridge.js** — chạy trong `ISOLATED world`, làm cầu nối giữa trang web (`window.postMessage`) và Service Worker (`chrome.runtime.sendMessage`).
- **background.js** — Service Worker trung tâm, quản lý hàng đợi (queue), mở/đóng tab, giữ trạng thái bền vững qua `chrome.storage.session`.

---

## Chức năng chính

### 1. Quản lý hàng đợi task tự động (Queue Engine)
- **START QUEUE**: quét các dòng task "chưa hoàn thành" trên trang worker-job, đưa vào hàng đợi và bắt đầu mở tab xử lý.
- **STOP QUEUE**: dừng nhận task mới, xoá toàn bộ pending tasks (tab đang mở vẫn tiếp tục chạy).
- **RESET QUEUE**: reset toàn bộ trạng thái queue (dừng + xoá pending).
- Giới hạn số tab chạy song song (**Concurrent Tabs**, mặc định 3, tối đa 50).
- Giãn cách thời gian giữa các lần mở tab mới (**Delay**, mặc định 600ms) để tránh mở ồ ạt gây treo máy.
- Tự động "bù" tab mới ngay khi một tab task hoàn thành/đóng, để luôn duy trì đúng số lượng tab đang chạy song song.

### 2. Nhận diện & mở task tự động
- Quét bảng dữ liệu (Ant Design table) trên trang worker để tìm các dòng có trạng thái `to be submitted` hoặc `assigned for collection` và có nút **Review** khả dụng.
- Tự động dò các tham số cần thiết (`jobId`, `projectId`, `flowId`, `title`, `locale`, `businessType`) từ các response API của trang (fetch/XHR hook) để tự sinh URL review chính xác cho từng `recordId`.
- Bỏ qua các task đã `Reviewed` hoặc có kết luận `Passed`.
- Tránh mở trùng: không mở lại task đã có tab đang chạy (dựa theo `recordId`) hoặc đã có trong hàng đợi.

### 3. Theo dõi & xử lý vòng đời của từng tab task
- **Task submit thành công**: hook `fetch`/`XMLHttpRequest` để phát hiện request `POST /api/task-submit` thành công → tự động báo về background → đóng tab → mở task tiếp theo.
- **Task page không hợp lệ**: phát hiện cảnh báo *"Please do not open multiple task page"* → coi là task lỗi, tự đóng tab và thay bằng task khác.
- **Tab bị đóng thủ công**: dọn dẹp mapping tương ứng, không tự tạo task thay thế ngay (chờ lần `FILL_QUEUE` kế tiếp).
- **Theo dõi trạng thái tab** (`loading`, `complete`, URL hiện tại...) để phục vụ giám sát/log.

### 4. Tự động reload trang trắng (Blank Page Auto-Reload)
- Theo dõi iframe annotation (`/ssr/tools/video-track-v2.html`); nếu iframe không xuất hiện trong một khoảng thời gian nhất định (**Blank Reload**, mặc định 8000ms) thì coi là trang bị "trắng".
- Tự động reload trang tối đa **Max Auto Reload** lần (mặc định 3 lần), đếm số lần reload qua `sessionStorage` để tránh vòng lặp reload vô hạn.
- Dừng theo dõi khi đã đạt số lần reload tối đa, hoặc khi tính năng bị tắt (`Max Auto Reload = 0`).

### 5. Giao diện điều khiển trên trang worker
- Chèn 3 nút nổi (floating buttons) trên trang worker-job: **START QUEUE**, **STOP**, **RESET**.
- Nút START tự đổi trạng thái hiển thị: `START QUEUE` → `RUNNING (n)` → `PAUSED (n)` tuỳ theo queue đang chạy/dừng và số tab đang active.
- Cập nhật realtime số lượng tab đang chạy dựa trên thông điệp `QUEUE_STATUS` từ background.

### 6. Popup cấu hình (popup.html/js/css)
- Cho phép người dùng chỉnh và lưu 4 thông số:
  - **Delay** (ms giữa các lần mở task, 100–10000)
  - **Concurrent Tabs** (số task chạy song song, 1–50)
  - **Blank Reload** (thời gian chờ trước khi reload task trắng, 1000–60000ms)
  - **Max Auto Reload** (số lần reload tối đa cho một task trắng, 0–20)
- Tự động chuẩn hoá (clamp) giá trị nhập vào trong giới hạn cho phép.
- Lưu vào `chrome.storage.local`, hiển thị thông báo lưu thành công/thất bại.
- Hỗ trợ lưu nhanh bằng phím **Enter**.

### 7. Debug hỗ trợ
- Hàm `window.ankerReviewDebug()` (gọi từ Console trên trang worker) in ra:
  - Cấu hình đã dò được (`jobId`, `flowId`, `title`, `locale`, `projectId`, `businessType`).
  - Trạng thái hiện tại của queue: đang chạy hay không, số task đã mở/hoàn thành, danh sách record đang active, trạng thái báo cáo submit/invalid, delay hiện tại.

---

## Cấu trúc extension

```
├── manifest.json     # Khai báo Manifest V3, permissions, content scripts
├── background.js     # Service Worker: quản lý queue, tab, state persistence
├── main.js            # Content script (MAIN world): UI nút bấm, hook fetch/XHR, quét task
├── bridge.js          # Content script (ISOLATED world): cầu nối page <-> background
├── popup.html/css/js  # Giao diện cấu hình (delay, concurrent, blank reload, max reload)
```

**Domain được áp dụng:**
- `https://aidc-annotation-us.anker-in.com/*`
- `https://aidc-annotation-eu.anker-in.com/*`
- `https://aidc-annotation-cn.anker-in.com/*`

---

## Cài đặt cấu hình (Popup)

| Thông số | Mặc định | Khoảng cho phép | Ý nghĩa |
|---|---|---|---|
| Delay | 600 ms | 100 – 10000 | Thời gian chờ tối thiểu giữa mỗi lần mở task mới |
| Concurrent Tabs | 3 | 1 – 50 | Số task chạy song song cùng lúc |
| Blank Reload | 8000 ms | 1000 – 60000 | Thời gian chờ khi trang task bị trắng trước khi tự reload |
| Max Auto Reload | 3 | 0 – 20 | Số lần tối đa cho phép tự reload một task bị trắng |

---

## Cơ chế hoạt động

1. Người dùng mở trang **worker-job**, extension chèn nút điều khiển và đăng ký tab hiện tại làm **controller**.
2. Bấm **START QUEUE** → quét danh sách task khả dụng → gửi sang background để mở tab song song theo giới hạn `Concurrent Tabs`.
3. Mỗi tab task được background theo dõi trạng thái (qua hook fetch/XHR và DOM watcher trong `main.js`).
4. Khi task submit thành công / bị phát hiện lỗi / hoặc bị đóng thủ công → background dọn dẹp, thông báo về worker tab → worker tab tự động quét và bù task mới vào chỗ trống, có tôn trọng độ trễ cấu hình.
5. Trạng thái hàng đợi (`QUEUE_STATUS`) được đồng bộ liên tục về giao diện nút bấm trên trang worker.

---

## Self-heal & Persistence

- Toàn bộ trạng thái runtime (queue bật/tắt, danh sách pending, danh sách tab đang active) được lưu vào `chrome.storage.session`, giúp phục hồi khi Service Worker bị Chrome tắt và khởi động lại (đặc thù Manifest V3).
- `chrome.alarms` được dùng để đánh thức Service Worker định kỳ (mỗi 30 giây), thực hiện:
  - Đối chiếu lại danh sách tab thực tế đang mở trong trình duyệt, dọn các mapping trỏ đến tab đã không còn tồn tại.
  - Tiếp tục mở task còn lại trong hàng đợi nếu queue đang bật.