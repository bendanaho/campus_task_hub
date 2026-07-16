package com.example.keshe_backend.post.dto;

import com.example.keshe_backend.task.entity.Task;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 帖子 DTO（对齐 JS 端 task 对象字段）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostDTO {
    private Long id;
    private String title;
    private String publisherSide;
    private String category;
    private String description;
    private Long publisherId;
    private String publisherName;
    private String publisherAvatar;   // 发布者头像 URL；Task 未冗余存，由 Service 层批量回填
    private BigDecimal publisherCredit;
    private String reward;
    private BigDecimal rewardValue;
    private LocalDateTime deadline;
    private LocalDateTime publishTime;
    private String status;
    private String contact;
    private List<ImageItem> images;  // 前端期望 [{full, thumb}]
    private String serviceTime;

    private BigDecimal takerCredit;

    public static PostDTO from(Task task) {
        return PostDTO.builder()
                .id(task.getId())
                .title(task.getTitle())
                .publisherSide(task.getPublisherSide())
                .category(task.getCategory())
                .description(task.getDescription())
                .publisherId(task.getPublisherId())
                .publisherName(task.getPublisherName())
                .publisherCredit(task.getPublisherCredit())
                .reward(task.getReward())
                .rewardValue(task.getRewardValue())
                .deadline(task.getDeadline())
                .publishTime(task.getPublishTime())
                .status(task.getStatus())
                .contact(task.getContact())
                .images(parseImages(task.getImages()))
                .serviceTime(task.getServiceTime())
                .build();
    }

    /**
     * 列表/大厅专用：在 {@link #from} 基础上剥离原图 full，只保留缩略图 thumb。
     * 大厅一次返回多条帖子，若带 full 原图会让响应体积暴涨（实测曾达 ~19MB）；
     * 列表只需缩略图，原图在用户点击后经 /api/posts/{id} 详情接口按需加载。
     */
    public static PostDTO fromLite(Task task) {
        PostDTO dto = from(task);
        if (dto.getImages() != null) {
            for (ImageItem it : dto.getImages()) {
                it.setFull(null);
            }
        }
        return dto;
    }

    // 解析图片 JSON。新格式 [{"full":"...","thumb":"..."}]；
    // 兼容旧格式 ["base64",...]（纯字符串数组，视为 full=thumb=旧值），保证种子/旧帖不崩。
    private static List<ImageItem> parseImages(String imagesJson) {
        List<ImageItem> result = new ArrayList<>();
        if (imagesJson == null || imagesJson.isBlank()) {
            return result;
        }
        int i = 0, n = imagesJson.length();
        while (i < n) {
            char c = imagesJson.charAt(i);
            if (c == '{') {
                // 对象元素：提取 full / thumb
                int end = imagesJson.indexOf('}', i);
                if (end < 0) break;
                String obj = imagesJson.substring(i, end + 1);
                result.add(ImageItem.builder()
                        .full(extractStringValue(obj, "full"))
                        .thumb(extractStringValue(obj, "thumb"))
                        .build());
                i = end + 1;
            } else if (c == '"') {
                // 旧格式：纯字符串元素 -> full=thumb=该字符串
                int[] endPos = readString(imagesJson, i);
                String s = unescape(imagesJson.substring(i + 1, endPos[0]));
                result.add(ImageItem.builder().full(s).thumb(s).build());
                i = endPos[1];
            } else {
                i++;
            }
        }
        return result;
    }

    // 从对象文本 {"full":"...","thumb":"..."} 中提取某字段的字符串值（已反转义）
    private static String extractStringValue(String obj, String field) {
        String key = "\"" + field + "\"";
        int idx = obj.indexOf(key);
        if (idx < 0) return "";
        int colon = obj.indexOf(':', idx + key.length());
        if (colon < 0) return "";
        int q1 = obj.indexOf('"', colon + 1);
        if (q1 < 0) return "";
        int[] endPos = readString(obj, q1);
        return unescape(obj.substring(q1 + 1, endPos[0]));
    }

    // 从 start（指向起始引号）读取一个 JSON 字符串，返回 [结束引号位置, 结束引号下一位置]
    private static int[] readString(String s, int start) {
        int j = start + 1;
        while (j < s.length()) {
            char ch = s.charAt(j);
            if (ch == '\\') { j += 2; continue; }
            if (ch == '"') return new int[]{j, j + 1};
            j++;
        }
        return new int[]{s.length(), s.length()};
    }

    // 反转义 JSON 字符串内容（与 PostService.esc 互逆）
    private static String unescape(String s) {
        if (s.indexOf('\\') < 0) return s;
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char next = s.charAt(++i);
                switch (next) {
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case '"': sb.append('"'); break;
                    case '\\': sb.append('\\'); break;
                    case '/': sb.append('/'); break;
                    default: sb.append(next);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** 图片项：原图 + 缩略图（一张图保存两份） */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageItem {
        private String full;
        private String thumb;
    }
}
