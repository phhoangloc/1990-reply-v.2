# 1990 - REPLY

Trình giả lập NES chạy ngay trên trình duyệt, kèm phòng chơi 2 người qua liên kết mời.

- Giả lập chạy hoàn toàn trên trình duyệt, Node.js chỉ phục vụ file và ghép cặp người chơi.
- Hỗ trợ phím bàn phím, tay cầm và nút cảm ứng trên điện thoại.
- Đổi phím điều khiển theo ý muốn.
- Chơi 2 người qua liên kết `/<mã phòng>`. Người được mời không cần có ROM.

## Yêu cầu

- [Node.js](https://nodejs.org) 18 trở lên (đã thử trên v22).
- Một trình duyệt hiện đại (Chrome, Edge, Firefox, Safari).
- File ROM `.nes` của bạn (hoặc `.zip` chứa ROM). Dự án **không** kèm ROM.

## Cài đặt và chạy

```bash
npm install
npm start
```

Mở http://localhost:3000.

Đổi cổng bằng biến môi trường `PORT`:

```bash
# macOS / Linux / Git Bash
PORT=5173 npm start

# PowerShell
$env:PORT = 5173; npm start
```

Nếu thấy lỗi `EADDRINUSE` nghĩa là cổng đang bị chương trình khác dùng, hãy chọn cổng khác.

## Chơi một mình

1. Bấm **Nạp ROM** (hoặc bấm vào khung game, hoặc kéo-thả file vào trang).
2. Chọn file `.nes` hoặc `.zip` có chứa ROM.
3. Chơi thôi.

Với game có pin (ghi chú 💾 ở thanh trạng thái), tiến trình lưu được ghi vào `localStorage` của trình duyệt và tự nạp lại lần sau.

### Phím điều khiển mặc định

| Chức năng | Phím |
| --- | --- |
| Di chuyển | `←` `↑` `↓` `→` hoặc `W` `A` `S` `D` |
| Nút A | `X` hoặc `K` |
| Nút B | `Z` hoặc `J` |
| Select | `Shift` hoặc `Backspace` |
| Start | `Enter` |
| Tua nhanh (giữ) | `Space` |
| Tạm dừng | `P` |
| Khởi động lại | `R` |
| Tắt / bật tiếng | `M` |
| Toàn màn hình | `F` |

Các phím chức năng (`Space`, `P`, `R`, `M`, `F`) là cố định và không gán lại được.

Tay cầm: được nhận tự động (bấm một nút để trình duyệt nhận diện). Trên điện thoại, nút cảm ứng hiện sẵn dưới màn hình.

### Đổi phím điều khiển

1. Bấm **Phím điều khiển** trên thanh công cụ.
2. Bấm vào ô phím muốn đổi, rồi nhấn phím mới. Mỗi nút có 2 ô nên gán được 2 phím.
3. `Esc` để hủy, `Delete` để xóa phím trong ô đó.
4. Phím mới trùng với nút khác sẽ tự bị gỡ khỏi nút cũ.
5. **Mặc định** khôi phục bộ phím ban đầu. Cấu hình được lưu trong trình duyệt.

### Tùy chọn hiển thị và âm thanh

- **Âm lượng**: thanh trượt trên thanh công cụ.
- **Làm mịn**: làm mịn hình khi phóng to.
- **Cắt viền 8px**: cắt viền trên dưới như màn hình TV thật.
- **Toàn màn hình**: nút trên thanh công cụ hoặc phím `F`.

## Chơi 2 người

1. Nạp ROM và bấm **Phòng 2 người** → **Tạo phòng**.
2. Địa chỉ trang đổi thành dạng `http://<máy chủ>/ABC123`. Bấm **Sao chép** và gửi liên kết cho bạn bè.
3. Bạn bè mở liên kết là tự vào phòng. Họ không cần ROM vì ROM được gửi tự động từ máy bạn.
4. Hai bên chơi chung: người tạo phòng là người chơi 1, người vào sau là người chơi 2. Mỗi người dùng phím và tay cầm của máy mình.

Cách phòng hoạt động:

- Bạn vẫn chơi bình thường khi chưa có ai vào phòng.
- Người vào sau nhận đúng trạng thái game đang chơi, không phải bắt đầu lại.
- Ai ra khỏi phòng cũng không làm người còn lại bị dừng. Người ở lại tiếp tục chơi một mình ở đúng chỗ đang chơi.
- Phòng đóng khi cả hai cùng rời. Liên kết cũ khi đó sẽ báo phòng không tồn tại.
- Khi đang chơi chung: **Tạm dừng, Khởi động lại, tua nhanh và đổi ROM bị khóa** để hai máy không bị lệch nhau.
- Khi chơi chung, game không đọc hay ghi file save cục bộ.

### Mời bạn bè ở xa

`localhost` chỉ truy cập được trên máy bạn. Để bạn bè vào được:

- **Cùng mạng LAN / Wi‑Fi**: dùng liên kết dạng `http://<IP máy bạn>:<cổng>/<mã phòng>` (thay `localhost` trong liên kết bằng IP của máy chạy server).
- **Khác mạng**: cần đưa server lên một máy chủ có địa chỉ công khai, hoặc dùng công cụ tạo đường hầm (tunnel). Nếu dùng HTTPS thì WebSocket tự chuyển sang `wss://`.

## Game được hỗ trợ

Giả lập hỗ trợ các mapper: **0 (NROM), 1 (MMC1), 2 (UxROM), 3 (CNROM), 4 (MMC3), 7 (AxROM), 11 (Color Dreams), 66 (GxROM), 71 (Camerica)**. Đây là phần lớn thư viện game NES phổ biến. ROM dùng mapper khác sẽ báo lỗi khi nạp.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| `EADDRINUSE` khi `npm start` | Cổng đang bị chiếm, chạy lại với `PORT` khác. |
| Báo "Mapper … chưa được hỗ trợ" | ROM dùng mapper ngoài danh sách trên. |
| Không có tiếng | Bấm vào trang một lần để trình duyệt cho phép âm thanh; kiểm tra phím `M` (tắt tiếng) và thanh âm lượng. |
| Bạn bè vào liên kết báo "Phòng … không tồn tại" | Người tạo phòng đã thoát hoặc tải lại trang. Tạo phòng mới và gửi liên kết mới. |
| Chơi chung bị khựng | Một bên mạng chậm hoặc đang để tab ở nền; game chờ phím của bên kia. Đưa tab lên phía trước và kiểm tra mạng. |
| Hai bên thấy hình khác nhau | Hãy rời phòng, tạo phòng mới và vào lại. |

## Cấu trúc dự án

```
.
├── server.js        # Server HTTP + WebSocket (phòng chơi)
├── package.json
└── public/
    └── index.html   # Toàn bộ giả lập và giao diện
```

- Server tĩnh phục vụ thư mục `public/`. Mọi đường dẫn không có đuôi file (ví dụ `/ABC123`) đều trả về `index.html`.
- WebSocket nằm ở `/ws`, dùng thư viện [`ws`](https://github.com/websockets/ws).

## Lưu ý về ROM

Hãy chỉ dùng và chia sẻ những ROM mà bạn có quyền sử dụng. Khi chơi 2 người, ROM đi qua server chỉ để chuyển tiếp và không được lưu lại.
