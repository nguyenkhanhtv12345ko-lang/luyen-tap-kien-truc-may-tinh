# Luyện tập Kiến trúc máy tính

[Mở bài luyện trên GitHub Pages](https://nguyenkhanhtv12345ko-lang.github.io/luyen-tap-kien-truc-may-tinh/).

Ngân hàng 107 câu lấy từ bản Word **107 cau trac nghiem on tap Kien truc may tinh.docx**. Trang giữ thứ tự câu và phương án của tài liệu trong chế độ nguyên bản. Sau khi trả lời, mỗi câu hiện giải thích ngắn, thuật ngữ Việt–Anh nếu cần và số slide đối chiếu. Phần giải thích được lưu trong `study-notes.mjs` theo số câu gốc.

Tham khảo cho phần giải thích mở rộng. [Tổ chức máy tính](https://www.uvm.edu/~cbcafier/cs2210/content/02_basics_of_architecture/org_vs_arch.html), [ISA và vi kiến trúc](https://docs.riscv.org/reference/isa/_attachments/riscv-unprivileged.pdf), [Intel Hyper-Threading](https://www.intel.com/content/dam/www/public/us/en/documents/research/2002-vol06-iss-1-intel-technology-journal.pdf), [giao tiếp SATA](https://www.seagate.com/support/disc/manuals/sata/sata_im.pdf), [kết nối PCIe](https://pcisig.com/sites/default/files/files/PCI-SIG%20Cabling%20Webinar_FINAL.pdf), [bộ nhớ NAND và SSD](https://www.micron.com/about/micron-glossary/solid-state-drives).

| Bộ | Câu gốc | Số câu |
| --- | --- | --- |
| Toàn bộ câu hỏi | 1–107 | 107 |
| Đề 1 | 1–22 | 22 |
| Đề 2 | 23–44 | 22 |
| Đề 3 | 45–65 | 21 |
| Đề 4 | 66–86 | 21 |
| Đề 5 | 87–107 | 21 |

Khi đảo phương án, ứng dụng chấm theo ID nội dung gốc. Câu có phương án tham chiếu chữ cái hoặc vị trí giữ thứ tự phương án gốc. Bộ hiện tại có 107 đáp án xác định và 0 câu cần đối chiếu. Bộ lọc **Cần đối chiếu** sẽ hiện các mục bị đánh dấu nếu ngân hàng được cập nhật.

## Chạy tại máy

```sh
python -m http.server 8000
node --test tests/quiz.test.mjs
```

Mở [trang luyện tập cục bộ](http://localhost:8000/).

## Nhập lại từ Word

```sh
python tools/import_questions.py "107 cau trac nghiem on tap Kien truc may tinh.docx" questions.json
```

Tệp Word dùng các kiểu đoạn `QuizLine`, `QuizOption` và `QuizEvidence`. Nếu có đính chính được xác nhận, thêm đối số `--overrides` trỏ đến tệp JSON ánh xạ số câu gốc sang chữ cái đáp án.

Lượt hiện tại, thứ tự đã đảo, đáp án và dấu ôn được lưu trong trình duyệt với khóa `kien-truc-may-tinh-107/v1`.
