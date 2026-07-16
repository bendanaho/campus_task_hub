package com.example.keshe_backend.post.service;

import static com.example.keshe_backend.transaction.service.WalletService.relPost;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import com.example.keshe_backend.common.security.SecurityUtils;
import com.example.keshe_backend.common.util.ImageUtil;
import com.example.keshe_backend.chat.service.ChatService;
import com.example.keshe_backend.order.entity.Order;
import com.example.keshe_backend.order.repository.OrderRepository;
import com.example.keshe_backend.post.dto.*;
import com.example.keshe_backend.report.service.ReportService;
import com.example.keshe_backend.task.entity.Task;
import com.example.keshe_backend.task.repository.TaskRepository;
import com.example.keshe_backend.transaction.service.WalletService;
import com.example.keshe_backend.user.entity.User;
import com.example.keshe_backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.io.File;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class PostService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ReportService reportService;
    private final ChatService chatService;
    private final OrderRepository orderRepository;
    private final WalletService walletService;

    /** 与上传接口同一个目录：用于判断某张图的缩略图文件是否已生成 */
    @org.springframework.beans.factory.annotation.Value("${app.upload-dir:./uploads}")
    private String uploadDir;

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
                // 近义词搜索：把关键词扩展为一组近义词，对每个词在标题/描述/发布者名上做 LIKE 后 OR
                List<Predicate> ors = new ArrayList<>();
                for (String term : com.example.keshe_backend.common.util.SynonymDict.expand(keyword)) {
                    String like = "%" + term + "%";
                    ors.add(cb.like(cb.lower(root.get("title")), like));
                    ors.add(cb.like(cb.lower(root.get("description")), like));
                    ors.add(cb.like(cb.lower(root.get("publisherName")), like));
                }
                preds.add(cb.or(ors.toArray(new Predicate[0])));
            }
            return cb.and(preds.toArray(new Predicate[0]));
        };

        Pageable pageable = PageRequest.of(page, size, buildSort(sort));
        Page<Task> taskPage = taskRepository.findAll(spec, pageable);
        List<PostDTO> list = taskPage.getContent().stream()
                .map(PostDTO::fromLite)   // 大厅只返回缩略图，原图点开详情再取
                .collect(Collectors.toList());
        fillPublisherAvatars(list);       // 批量回填发布者头像（一次查库，避免逐条 N+1）
        return PostPageResponse.builder()
                .list(list)
                .hasMore(taskPage.hasNext())
                .total(taskPage.getTotalElements())
                .page(page)
                .size(size)
                .build();
    }

    /**
     * 批量给一批 PostDTO 回填发布者头像。
     * Task 实体只冗余存了发布者名/信用分，没存头像；这里按 publisherId 去重后一次 findAllById，
     * 建 id→avatar 映射再回填，保证大厅一页（多条帖子）只多一次库查询，不产生 N+1。
     */
    private void fillPublisherAvatars(List<PostDTO> list) {
        if (list == null || list.isEmpty()) return;
        Set<Long> ids = list.stream()
                .map(PostDTO::getPublisherId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return;
        Map<Long, String> avatarById = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) {
            avatarById.put(u.getId(), u.getAvatar());
        }
        for (PostDTO dto : list) {
            if (dto.getPublisherId() != null) {
                dto.setPublisherAvatar(avatarById.get(dto.getPublisherId()));
            }
        }
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
                .task(PostDTO.fromLite(task))   // 详情默认也不发原图,避免打开详情/订单页下载数 MB 原图
                .publisher(pubDTO)
                .build();
    }

    /**
     * 按需获取某帖的原图列表 [{full, thumb}]，供前端"点击缩略图放大"时单独拉取。
     * 与 getPostDetail 分离，保证详情/订单页本身加载轻快。
     */
    public List<PostDTO.ImageItem> getPostImages(Long id) {
        Task task = taskRepository.findById(id)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));
        return PostDTO.from(task).getImages();
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

        // 防重复提交：同一用户在 30 秒内发布过相同标题+描述的帖子，判定为重复点击/网络重试，直接拦截。
        // 前端已加按钮锁，这里是服务端兜底，防多标签页 / 直接调接口 / 网络重发造成的重复入库。
        LocalDateTime dupSince = LocalDateTime.now().minusSeconds(30);
        if (taskRepository.countByPublisherIdAndTitleAndDescriptionAndDeletedAtIsNullAndPublishTimeAfter(
                userId, request.getTitle(), request.getDescription(), dupSince) > 0) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "请勿重复提交，刚刚已发布过相同内容");
        }

        // 悬赏帖截止时间不能早于当前时间
        if ("payer".equals(side) && request.getDeadline() != null
                && request.getDeadline().isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.POST_EXPIRED);
        }

        // 报酬金额最多两位小数（与充值/转账一致）
        if (request.getRewardValue() != null && request.getRewardValue().scale() > 2) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "报酬金额最多支持两位小数");
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

        // 发布"我出钱"(悬赏)：从可用余额冻结报酬做担保；余额不足 → 抛异常、整体回滚、无法发布
        if ("payer".equals(side)) {
            BigDecimal reward = task.getRewardValue() != null ? task.getRewardValue() : BigDecimal.ZERO;
            if (reward.signum() > 0) {
                walletService.hold(userId, reward, "escrow_freeze", relPost(task.getId()),
                        "发布悬赏冻结报酬：" + task.getTitle());
            }
        }

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
                .stream().map(PostDTO::fromLite).collect(Collectors.toList());
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

        // 取消该帖待接受的订单（与发布者撤回 ownerClosePost 语义一致）。
        // 必须做：acceptOrder 只校验订单状态、不校验帖子状态，若留着 pending 订单，
        // 下面把报酬退了之后对方仍能接受它 → 完成时 release 会把 frozen 扣成负数。
        List<Order> pendings = orderRepository.findByPostIdAndStatusIn(postId, Arrays.asList("pending"));
        for (Order o : pendings) {
            o.setStatus("cancelled");
            orderRepository.save(o);
            chatService.addSystemMessage(o.getChatId(),
                    "该互助「" + task.getTitle() + "」已被管理员下架，订单已取消",
                    String.valueOf(task.getId()), task.getTitle());
        }

        // 悬赏帖：报酬在【发布时】就冻结了，下架后该帖再也无法成单，这笔钱必须退回发布者，
        // 否则会永久冻在他账上（ownerClosePost 撤回时会退，这里此前漏了）。
        // 悬赏帖被接单时 acceptOrder 会把帖子置为 closed，故能走到这里的 open 悬赏帖必然没有
        // in_progress 订单占用这笔冻结，全额退回是安全的。
        if ("payer".equals(task.getPublisherSide())) {
            BigDecimal reward = task.getRewardValue() != null ? task.getRewardValue() : BigDecimal.ZERO;
            if (reward.signum() > 0) {
                walletService.refund(task.getPublisherId(), reward, "escrow_refund", relPost(task.getId()),
                        "帖子被管理员下架，退回冻结报酬：" + task.getTitle());
            }
        }

        chatService.addSystemNotify(task.getPublisherId(),
                "你发布的「" + task.getTitle() + "」已被管理员下架，大厅将不再展示。"
                        + (!r.isEmpty() ? "原因：" + r : "如有疑问请联系平台。"));
        broadcastTaskClosed(postId);
        return PostDTO.from(task);
    }

    /** 管理员删除帖子（软删）：设 deletedAt，全站不可见/不可查/不可下单，记录保留；清该帖 pending 举报；系统通知发布者 */
    @Transactional
    public PostDTO adminDeletePost(Long postId, String reason) {
        Task task = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));

        // 高危防护：软删后 getPostDetail 直接 404，该帖上仍活跃的订单会失去任务详情
        // （聊天页任务栏拿不到任务 → 双方无法确认完成/申诉），付款方冻结的钱将卡死。
        // 因此有 pending/in_progress 订单时禁止删除，先让管理员把订单处理掉（下架不受此限）。
        List<Order> activeOrders = orderRepository.findByPostIdAndStatusIn(
                postId, Arrays.asList("pending", "in_progress"));
        if (!activeOrders.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR,
                    "该帖有 " + activeOrders.size() + " 个进行中/待接受的订单，删除会导致订单卡死、资金无法解冻。"
                            + "请先下架该帖并处理完这些订单，或改用「下架」。");
        }

        task.setDeletedAt(LocalDateTime.now());
        taskRepository.save(task);
        reportService.markReportsHandled(postId);
        String r = reason == null ? "" : reason.trim();
        chatService.addSystemNotify(task.getPublisherId(),
                "你发布的「" + task.getTitle() + "」已被管理员删除。"
                        + (!r.isEmpty() ? "原因：" + r : "如有疑问请联系平台。"));
        broadcastTaskClosed(postId);
        return PostDTO.from(task);
    }

    /**
     * 我的帖子
     */
    public List<PostDTO> getMyPosts() {
        Long userId = SecurityUtils.getCurrentUserId();
        return taskRepository.findByPublisherIdAndDeletedAtIsNullOrderByPublishTimeDesc(userId)
                .stream()
                .map(PostDTO::fromLite)
                .collect(Collectors.toList());
    }

    /**
     * 发布者撤回自己的帖子（软下架）：大厅不再显示；取消该帖所有 pending 申请；
     * in_progress 订单不动（继续走完结算）。仅 status=open 可撤回。
     */
    @Transactional
    public PostDTO ownerClosePost(Long postId) {
        Long userId = SecurityUtils.getCurrentUserId();
        Task task = taskRepository.findById(postId)
                .filter(t -> t.getDeletedAt() == null)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND_OR_CANCELLED));
        if (!task.getPublisherId().equals(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有发布者可以撤回");
        }
        if (!"open".equals(task.getStatus())) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "该帖子已不可撤回");
        }
        task.setStatus("closed");
        taskRepository.save(task);

        // 取消该帖所有 pending 订单（in_progress 不动，继续走完结算），并通知申请方
        List<Order> pendings = orderRepository.findByPostIdAndStatusIn(postId, Arrays.asList("pending"));
        for (Order o : pendings) {
            o.setStatus("cancelled");
            orderRepository.save(o);
            Long applicantId = o.getPayerId().equals(userId) ? o.getEarnerId() : o.getPayerId();
            chatService.addSystemMessage(o.getChatId(),
                    "发布者撤回了互助「" + task.getTitle() + "」，订单已取消",
                    String.valueOf(task.getId()), task.getTitle());
            try {
                com.example.keshe_backend.common.websocket.NotificationWSServer.sendToUser(applicantId,
                        "{\"type\":\"PERSONAL_NOTICE\",\"message\":\"您申请的互助『" + task.getTitle() + "』被发布者撤回，订单已取消。\"}");
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // 悬赏帖撤回：把发布时冻结的报酬退回发布者（仅 open 可撤回，此时未被接单，报酬仍全额冻结）
        if ("payer".equals(task.getPublisherSide())) {
            BigDecimal reward = task.getRewardValue() != null ? task.getRewardValue() : BigDecimal.ZERO;
            if (reward.signum() > 0) {
                walletService.refund(task.getPublisherId(), reward, "escrow_refund", relPost(task.getId()),
                        "撤回悬赏退回报酬：" + task.getTitle());
            }
        }
        broadcastTaskClosed(postId);
        return PostDTO.from(task);
    }


    /**
     * 广播「帖子已下架/移除」：让所有正在浏览大厅的人实时移除该卡片。
     * 此前只有发布(NEW_TASK)和被接单(TASK_TAKEN)会广播，下架/撤回/删除都不广播，
     * 于是别人的大厅一直留着这张卡 → 点"接单"进聊天再下单，才被后端以
     * TASK_NOT_FOUND_OR_CANCELLED（"任务不存在或已取消"）拒掉，白跑一趟。
     */
    private void broadcastTaskClosed(Long postId) {
        try {
            String msg = String.format("{\"type\":\"TASK_CLOSED\",\"postId\":%d}", postId);
            com.example.keshe_backend.common.websocket.NotificationWSServer.broadcast(msg);
        } catch (Exception e) {
            log.error("WebSocket 广播 TASK_CLOSED 失败", e);
        }
    }

    // 序列化为图片对象数组 [{"full":"...","thumb":"..."}]，写入端 esc() 转义引号/反斜杠/控制字符。
    // 一张图保存两份：full=原图 data URL，thumb=缩略图 data URL（由 ImageUtil 生成）。
    private String toImageJsonArray(List<String> fullUrls) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (String full : fullUrls) {
            if (!first) sb.append(",");
            first = false;
            String[] ft = fullAndThumbFor(full);
            sb.append("{\"full\":\"").append(esc(ft[0])).append("\",");
            sb.append("\"thumb\":\"").append(esc(ft[1])).append("\"}");
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 得到 {full, thumb} 两个值。
     * - 前端上传后传来的是 /uploads/xxx URL：缩略图文件已在上传时生成，按命名规则推导其 URL
     *   （文件不存在则回退用原图，例如 gif/webp 生成失败的情况）。
     * - 老客户端仍可能传 base64 data URL：走原来的 ImageUtil 转换，保证向后兼容。
     */
    private String[] fullAndThumbFor(String item) {
        if (item != null && item.startsWith("/uploads/")) {
            String name = item.substring("/uploads/".length());
            String thumbName = ImageUtil.thumbNameFor(name);
            File thumbFile = new File(uploadDir, thumbName);
            return new String[]{ item, thumbFile.exists() ? "/uploads/" + thumbName : item };
        }
        return ImageUtil.toFullAndThumb(item);
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
