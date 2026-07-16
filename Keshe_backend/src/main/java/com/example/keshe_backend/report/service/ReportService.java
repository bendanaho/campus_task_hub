package com.example.keshe_backend.report.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.post.dto.PostDTO;
import com.example.keshe_backend.report.dto.AdminReportItemResponse;
import com.example.keshe_backend.report.entity.Report;
import com.example.keshe_backend.report.repository.ReportRepository;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final com.example.keshe_backend.chat.service.ChatService chatService;

    /**
     * 普通用户举报帖子：登录、非管理员、非本人帖、(postId,reporterId) 去重。
     */
    @Transactional
    public void reportPost(Long postId, String reason) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));
        if (user.getRole() != null && user.getRole() == 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员账号无需举报");
        }

        Task post = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED, "帖子不存在"));
        if (post.getPublisherId().equals(userId)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "不能举报自己发布的帖子");
        }
        String r = reason == null ? "" : reason.trim();
        if (r.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请填写举报理由");
        }
        if (reportRepository.existsByPostIdAndReporterIdAndStatus(postId, userId, "pending")) {
            throw new BusinessException(ErrorCode.CONFLICT, "你已举报过该帖子，管理员会尽快处理");
        }
        // 管理员已驳回过同一人对同一帖的举报 → 不允许再提，防止反复刷举报骚扰
        if (reportRepository.existsByPostIdAndReporterIdAndStatus(postId, userId, "dismissed")) {
            throw new BusinessException(ErrorCode.CONFLICT, "你对该帖的举报经管理员核实未通过，无法重复举报");
        }

        Report report = new Report();
        report.setPostId(postId);
        report.setReporterId(userId);
        report.setReporterName(user.getUsername());
        report.setReason(r);
        report.setStatus("pending");
        reportRepository.save(report);
    }

    /**
     * 管理员查看举报：按帖子聚合 pending 举报（已删帖不展示），按举报次数倒序。
     */
    public List<AdminReportItemResponse> adminListReports() {
        Map<Long, AdminReportItemResponse> byPost = new LinkedHashMap<>();
        for (Report rep : reportRepository.findByStatus("pending")) {
            Task post = taskRepository.findById(rep.getPostId())
                    .filter(t -> t.getDeletedAt() == null).orElse(null);
            if (post == null) continue;
            AdminReportItemResponse item = byPost.get(rep.getPostId());
            if (item == null) {
                item = AdminReportItemResponse.builder()
                        .post(PostDTO.from(post))
                        .reportCount(0)
                        .reasons(new ArrayList<>())
                        .build();
                byPost.put(rep.getPostId(), item);
            }
            item.setReportCount(item.getReportCount() + 1);
            item.getReasons().add(AdminReportItemResponse.ReasonItem.builder()
                    .reporterName(rep.getReporterName())
                    .reason(rep.getReason())
                    .createdAt(rep.getCreatedAt())
                    .build());
        }
        List<AdminReportItemResponse> list = new ArrayList<>(byPost.values());
        list.sort(Comparator.comparingInt(AdminReportItemResponse::getReportCount).reversed());
        return list;
    }

    /**
     * 管理员驳回举报（忽略）：该帖 pending 举报 → dismissed，帖子保持原样（不下架、不删除）。
     * 用于误报/恶意举报——此前管理员只能下架或删除，无论举报是否成立都在惩罚发布者。
     * 只通知举报人：发布者本就不知道自己被举报，通知反而平白制造焦虑。
     *
     * @return 被驳回的举报条数
     */
    @Transactional
    public int dismissReports(Long postId, String reason) {
        Task post = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED, "帖子不存在"));
        List<Report> pending = reportRepository.findByPostIdAndStatus(postId, "pending");
        if (pending.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "该帖没有待处理的举报");
        }
        for (Report rep : pending) {
            rep.setStatus("dismissed");
        }
        reportRepository.saveAll(pending);

        String r = reason == null ? "" : reason.trim();
        for (Report rep : pending) {
            chatService.addSystemNotify(rep.getReporterId(),
                    "你举报的「" + post.getTitle() + "」经管理员核实未发现违规，该帖将继续展示。"
                            + (!r.isEmpty() ? "说明：" + r : ""));
        }
        return pending.size();
    }

    /**
     * 下架/删除帖子后，把该帖的 pending 举报标记为 handled。
     */
    @Transactional
    public void markReportsHandled(Long postId) {
        List<Report> pending = reportRepository.findByPostIdAndStatus(postId, "pending");
        for (Report rep : pending) {
            rep.setStatus("handled");
        }
        reportRepository.saveAll(pending);
    }
}
