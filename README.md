# MUSICNISO

**MUSICNISO** là một ứng dụng quản lý nhạc full-stack với frontend React và backend Express + Socket.IO, sử dụng MongoDB.

---

## 📦 Tính năng

- Đăng nhập người dùng + phân quyền
- Quản lý thư viện nhạc (tải lên / trích xuất metadata)
- Quản lý playlist và lịch phát
- Cập nhật thời gian thực qua Socket.IO (trạng thái online/offline, điều khiển phát, thông báo)
- API admin được bảo vệ bằng Basic Auth 

---

## 🧰 Công nghệ sử dụng

- **Frontend:** React (Create React App) + Ant Design
- **Backend:** Node.js + Express + Socket.IO
- **Database:** MongoDB (driver chính thức)

---

## 🚀 Yêu cầu cài đặt

- Node.js (>= 18 khuyến nghị)
- npm (>= 10 khuyến nghị)
- MongoDB đang chạy (cục bộ hoặc từ xa)

---

## 🛠️ Cài đặt

1. Clone repository

```bash
git clone <repo-url>
cd MUSICNISO
```

2. Cài đặt phụ thuộc

```bash
npm install
```

3. Đảm bảo MongoDB đang chạy.
   - Mặc định, ứng dụng dùng chuỗi kết nối trong `Backend/mongo.js`:
     - `mongodb://beesnext:xxxxlocalhost:27017/BeeNext?authSource=BeeNext`
   - Cập nhật file này nếu bạn muốn kết nối tới một MongoDB khác.

4. (Tùy chọn) Tạo `.env.local` nếu muốn lưu các cấu hình môi trường thêm.
   - Backend sẽ load `../.env.local` từ `Backend/server.js`.

---

## ▶️ Chạy ứng dụng

### 1) Khởi động backend

Từ thư mục gốc của repo:

```bash
node Backend/server.js
```

Backend lắng nghe trên **http://localhost:4004** và cung cấp API dưới đường dẫn `/api`.

### 2) Khởi động frontend

Từ thư mục gốc của repo:

```bash
npm start
```

Frontend chạy trên **http://localhost:3000** và kết nối đến backend qua Socket.IO.

---

## 🗂️ Cấu trúc dự án

- `Backend/` – Server Express, các route API, kết nối MongoDB, Socket.IO
- `src/` – Ứng dụng React
  - `src/components/` – Các trang và component giao diện
  - `src/hooks/` – custom React hooks
  - `src/styles/` – CSS styles
- `public/` – tài nguyên tĩnh

---

## 🔐 API admin

Các route admin được bảo vệ bằng Basic Auth (cùng credentials cho tất cả):

- Username: `ps123`
- Password: `ps123`

Đường dẫn cơ bản được bảo vệ: `/api/admin/*`

---

## 🧩 Ghi chú

- File tải lên được phục vụ từ `/uploads` (xem `Backend/server.js`).
- Ứng dụng có thư mục `Backend/routes/` chứa các endpoint.

---

