# Knight's Tour · Phòng mô phỏng

Website tương tác về bài toán mã đi tuần trên bàn cờ 8×8.

## Tính năng

- **Mô phỏng:** chọn ô xuất phát, đi từng bước hoặc chạy tự động, tạm dừng và đặt lại. Thuật toán tìm hành trình bằng quay lui với thứ tự nước đi Warnsdorff.
- **Tự khám phá:** tự chọn các nước mã hợp lệ trên những ô chưa thăm. AI gợi ý kiểm tra khả năng đi đủ 64 ô từ chính lộ trình hiện tại; ô viền xanh là nước đề xuất. Nút **Quay lại** xóa một nước để thử nhánh khác.
- Hiển thị thứ tự nước đi, ô hiện tại, số ô đã thăm và trạng thái hoàn thành hoặc bị kẹt.

AI gợi ý là bộ tìm kiếm thuật toán trong trình duyệt, không gửi dữ liệu bàn cờ tới dịch vụ AI. Bộ tìm kiếm giới hạn 50.000 nút để giao diện không bị treo lâu; khi chạm giới hạn, gợi ý theo Warnsdorff được ghi rõ là chưa bảo đảm đủ 64 ô.

## Chạy cục bộ

```bash
python -m http.server 8000 --directory dist
```

Mở `http://localhost:8000`. Không mở `index.html` trực tiếp từ file vì trang sử dụng JavaScript module.

## Kiểm thử

```bash
npm test
```

Không cần cài thêm gói. Mã nguồn nằm trong `dist/`, cấu hình Sites nằm ở `.openai/hosting.json`.
