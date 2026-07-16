package com.example.keshe_backend.common.upload;

import com.example.keshe_backend.common.api.ApiResponse;
import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * 通用图片上传：保存到本地 upload-dir，返回可访问 URL（/uploads/xxx，由 Nginx 提供）。
 * 用于头像、个人展示照片、聊天图片等——图片以文件存储、URL 入库，避免 base64 撑大数据库。
 */
@RestController
@RequestMapping("/api")
public class UploadController {

    @Value("${app.upload-dir:./uploads}")
    private String uploadDir;

    @PostMapping("/upload")
    public ApiResponse<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "上传文件为空");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "只能上传图片文件");
        }
        if (file.getSize() > 10L * 1024 * 1024) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "图片不能超过 10MB");
        }
        // 扩展名：从 content-type 推断，白名单兜底
        String ext = switch (contentType.toLowerCase()) {
            case "image/png" -> "png";
            case "image/gif" -> "gif";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
        String name = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        try {
            File dir = new File(uploadDir);
            if (!dir.exists() && !dir.mkdirs()) {
                throw new BusinessException(ErrorCode.PARAM_ERROR, "无法创建上传目录");
            }
            file.transferTo(new File(dir, name).getAbsoluteFile());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.PARAM_ERROR, "图片保存失败");
        }
        return ApiResponse.success(Map.of("url", "/uploads/" + name));
    }
}
