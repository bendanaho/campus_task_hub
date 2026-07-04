package com.example.keshe_backend.post.service;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.post.dto.*;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PostService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    /**
     * 帖子列表（支持筛选和排序）
     */
    public List<PostDTO> listPosts(String side, String categories, String keyword, String sort) {
        List<Task> tasks = taskRepository.findByDeletedAtIsNullOrderByPublishTimeDesc();

        LocalDateTime now = LocalDateTime.now();

        return tasks.stream()
                // 只显示 open 的帖子
                .filter(t -> "open".equals(t.getStatus()))
                // 过滤过期悬赏帖
                .filter(t -> !("payer".equals(t.getPublisherSide())
                        && t.getDeadline() != null && t.getDeadline().isBefore(now)))
                // 按 side 筛选
                .filter(t -> side == null || side.isEmpty() || "all".equals(side)
                        || side.equals(t.getPublisherSide()))
                // 按分类筛选
                .filter(t -> categories == null || categories.isEmpty()
                        || Arrays.asList(categories.split(",")).contains(t.getCategory()))
                // 按关键词搜索
                .filter(t -> keyword == null || keyword.isEmpty()
                        || matchesKeyword(t, keyword))
                // 排序
                .sorted((a, b) -> compareBySort(a, b, sort))
                .map(PostDTO::from)
                .collect(Collectors.toList());
    }

    private boolean matchesKeyword(Task t, String keyword) {
        String lower = keyword.toLowerCase();
        return (t.getTitle() != null && t.getTitle().toLowerCase().contains(lower))
                || (t.getDescription() != null && t.getDescription().toLowerCase().contains(lower))
                || (t.getPublisherName() != null && t.getPublisherName().contains(keyword));
    }

    private int compareBySort(Task a, Task b, String sort) {
        if (sort == null) sort = "time_desc";
        return switch (sort) {
            case "time_asc" -> a.getPublishTime().compareTo(b.getPublishTime());
            case "time_desc" -> b.getPublishTime().compareTo(a.getPublishTime());
            case "reward_asc" -> a.getRewardValue().compareTo(b.getRewardValue());
            case "reward_desc" -> b.getRewardValue().compareTo(a.getRewardValue());
            case "credit_asc" -> a.getPublisherCredit().compareTo(b.getPublisherCredit());
            case "credit_desc" -> b.getPublisherCredit().compareTo(a.getPublisherCredit());
            default -> b.getPublishTime().compareTo(a.getPublishTime());
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

        // 处理 images 列表转 JSON
        if (request.getImages() != null && !request.getImages().isEmpty()) {
            task.setImages(toJsonArray(request.getImages()));
        }

        task = taskRepository.save(task);
        com.example.keshe_backend.common.websocket.NotificationWSServer.broadcast("NEW_POST_PUBLISHED");
        return PublishPostResponse.of(PostDTO.from(task));
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

    // 序列化为 JSON 数组。写入端本身是正确的：esc() 会转义引号/反斜杠/控制字符，
    // 字符串内部的逗号原样保留——问题只在旧的读回端 PostDTO.parseImages 用 split(",") 切坏。
    private String toJsonArray(List<String> urls) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (String url : urls) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(esc(url)).append("\"");
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
