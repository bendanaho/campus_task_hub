package com.example.keshe_backend.report.dto;

import com.example.keshe_backend.post.dto.PostDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 管理端按帖子聚合的举报条目：{ post, reportCount, reasons:[{reporterName,reason,createdAt}] }
 * （字段名对齐 JS mock 的 mockGetAdminReports）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminReportItemResponse {

    private PostDTO post;
    private int reportCount;
    private List<ReasonItem> reasons;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReasonItem {
        private String reporterName;
        private String reason;
        private LocalDateTime createdAt;
    }
}
