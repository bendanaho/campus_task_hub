package com.example.keshe_backend.post.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.common.util.ImageUtil;
import com.example.keshe_backend.chat.service.ChatService;
import com.example.keshe_backend.post.dto.*;
import com.example.keshe_backend.report.service.ReportService;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PostService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ReportService reportService;
    private final ChatService chatService;

    /**
     * 帖子列表（大厅，支持筛选、排序、分页）
     */
    public PostPageResponse listPosts(String side, String categories, String keyword, String sort, int page, int size) {
        LocalDateTime now = LocalDateTime.now();

        Specification<Task> spec = (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            preds.add(cb.isNull(root.get("deletedAt")));
            preds.add(cb.equal(root.get("status"), "open"));
            // 排除过期悬赏帖：非 payer 或 deadline 为空 或 deadline >= now
            preds.add(cb.or(
                    cb.notEqual(root.get("publisherSide"), "payer"),
                    cb.isNull(root.get("deadline")),
                    cb.greaterThanOrEqualTo(root.get("deadline"), now)
            ));
            if (side != null && !side.isEmpty() && !"all".equals(side)) {
                preds.add(cb.equal(root.get("publisherSide"), side));
            }
            if (categories != null && !categories.isEmpty()) {
                preds.add(root.get("category").in(Arrays.asList(categories.split(","))));
            }
            if (keyword != null && !keyword.isEmpty()) {
                String like = "%" + keyword.toLowerCase() + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("description")), like),
                        cb.like(cb.lower(root.get("publisherName")), like)
                ));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page, size, buildSort(sort));
        Page<Task> taskPage = taskRepository.findAll(spec, pageable);
        List<PostDTO> list = taskPage.getContent().stream()
                .map(PostDTO::from)
                .collect(Collectors.toList());
        return PostPageResponse.builder()
                .list(list)
                .hasMore(taskPage.hasNext())
                .total(taskPage.getTotalElements())
                .page(page)
                .size(size)
                .build();
    }

    private Sort buildSort(String sort) {
        if (sort == null || sort.isBlank()) sort = "time_desc";
        return switch (sort) {
            case "time_asc" -> Sort.by(Sort.Direction.ASC, "publishTime");
            case "time_desc" -> Sort.by(Sort.Direction.DESC, "publishTime");
            case "reward_asc" -> Sort.by(Sort.Direction.ASC, "rewardValue");
            case "reward_desc" -> Sort.by(Sort.Direction.DESC, "rewardValue");
            case "credit_asc" -> Sort.by(Sort.Direction.ASC, "publisherCredit");
            case "credit_desc" -> Sort.by(Sort.Direction.DESC, "publisherCredit");
            default -> Sort.by(Sort.Direction.DESC, "publishTime");
        };
    }

    /**
     * 帖子详情
     */
    public PostDetailResponse getPostDetail(Long id) {
        Task task = taskRepository.findById(id)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));

        User publisher = userRepository.findById(task.getPublisherId())
                .orElse(null);

        PostPublisherDTO pubDTO = publisher != null
                ? PostPublisherDTO.from(publisher)
                : PostPublisherDTO.builder()
                    .id(task.getPublisherId())
                    .username(task.getPublisherName())
                    .creditScore(task.getPublisherCredit())
                    .build();

        return PostDetailResponse.builder()
                .task(PostDTO.from(task))
                .publisher(pubDTO)
                .build();
    }

    /**
     * 发布帖子
     */
    @Transactional
    public PublishPostResponse createPost(CreatePostRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.AUTH_REQUIRED));

        // 管理员为纯管理角色，不发布互助
        if (user.getRole() != null && user.getRole() == 1) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员账号不参与交易");
        }

        // 检查实名认证
        if (user.getAuthStatus() == null || user.getAuthStatus() != 1) {
            throw new BusinessException(ErrorCode.VERIFICATION_REQUIRED);
        }

        // 验证 publisherSide
        String side = request.getPublisherSide();
        if (!"payer".equals(side) && !"earner".equals(side) && !"none".equals(side)) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "publisherSide 必须为 payer/earner/none");
        }

        // 悬赏帖截止时间不能早于当前时间
        if ("payer".equals(side) && request.getDeadline() != null
                && request.getDeadline().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.POST_EXPIRED);
        }

        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setType(0); // 旧字段兼容，后续迁移可移除
        task.setPublisherSide(side);
        task.setCategory(request.getCategory());
        task.setDescription(request.getDescription());
        task.setReward(request.getReward());
        task.setRewardValue(request.getRewardValue() != null ? request.getRewardValue() : BigDecimal.ZERO);
        task.setDeadline(request.getDeadline());
        task.setContact(request.getContact() != null ? request.getContact() : "站内联系");
        task.setPublisherId(userId);
        task.setPublisherName(user.getUsername());
        task.setPublisherCredit(user.getCreditScore());
        task.setStatus("open");

        if ("earner".equals(side) && request.getServiceTime() != null) {
            task.setServiceTime(request.getServiceTime());
        }

        // 处理 images：每张原图生成缩略图，存 [{"full":"...","thumb":"..."}]（一张图保存两份）
        if (request.getImages() != null && !request.getImages().isEmpty()) {
            task.setImages(toImageJsonArray(request.getImages()));
        }

        task = taskRepository.save(task);
        try {
            String msg = String.format("{\"type\":\"NEW_TASK\",\"postId\":%d,\"title\":\"%s\"}", task.getId(), task.getTitle());
            com.example.keshe_backend.common.websocket.NotificationWSServer.broadcast(msg);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return PublishPostResponse.of(PostDTO.from(task));
    }

    // ---------- 管理员（由 /api/admin/** 的 ROLE_ADMIN 规则鉴权）----------

    /** 全部帖子（含已下架/关闭），按发布时间倒序 */
    public List<PostDTO> adminListPosts() {
        return taskRepository.findByDeletedAtIsNullOrderByPublishTimeDesc()
                .stream().map(PostDTO::from).collect(Collectors.toList());
    }

    /** 管理员下架帖子：status → closed，大厅不再显示、不可再下单；清该帖 pending 举报；系统通知发布者 */
    @Transactional
    public PostDTO adminClosePost(Long postId, String reason) {
        Task task = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));
        if ("closed".equals(task.getStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "该帖子已是下架/关闭状态");
        }
        task.setStatus("closed");
        taskRepository.save(task);
        reportService.markReportsHandled(postId);
        String r = reason == null ? "" : reason.trim();
        chatService.addSystemNotify(task.getPublisherId(),
                "你发布的「" + task.getTitle() + "」已被管理员下架，大厅将不再展示。"
                        + (!r.isEmpty() ? "原因：" + r : "如有疑问请联系平台。"));
        return PostDTO.from(task);
    }

    /** 管理员删除帖子（软删）：设 deletedAt，全站不可见/不可查/不可下单，记录保留；清该帖 pending 举报；系统通知发布者 */
    @Transactional
    public PostDTO adminDeletePost(Long postId, String reason) {
        Task task = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));
        task.setDeletedAt(LocalDateTime.now());
        taskRepository.save(task);
        reportService.markReportsHandled(postId);
        String r = reason == null ? "" : reason.trim();
        chatService.addSystemNotify(task.getPublisherId(),
                "你发布的「" + task.getTitle() + "」已被管理员删除。"
                        + (!r.isEmpty() ? "原因：" + r : "如有疑问请联系平台。"));
        return PostDTO.from(task);
    }

    /**
     * 我的帖子
     */
    public List<PostDTO> getMyPosts() {
        Long userId = SecurityUtils.getCurrentUserId();
        return taskRepository.findByPublisherIdAndDeletedAtIsNullOrderByPublishTimeDesc(userId)
                .stream()
                .map(PostDTO::from)
                .collect(Collectors.toList());
    }


    // 序列化为图片对象数组 [{"full":"...","thumb":"..."}]，写入端 esc() 转义引号/反斜杠/控制字符。
    // 一张图保存两份：full=原图 data URL，thumb=缩略图 data URL（由 ImageUtil 生成）。
    private String toImageJsonArray(List<String> fullUrls) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (String full : fullUrls) {
            if (!first) sb.append(",");
            first = false;
            String[] ft = ImageUtil.toFullAndThumb(full);
            sb.append("{\"full\":\"").append(esc(ft[0])).append("\",");
            sb.append("\"thumb\":\"").append(esc(ft[1])).append("\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    private String esc(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\b': sb.append("\\b");  break;
                case '\f': sb.append("\\f");  break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }
}
