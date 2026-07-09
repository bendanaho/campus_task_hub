package com.example.keshe_backend.common.util;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 图片工具：把原图 data URL 生成缩略图 data URL。
 * 用于"一张图保存两份（缩略图 + 原图）"：列表用缩略图、详情用原图。
 */
public class ImageUtil {

    private static final int THUMB_MAX_WIDTH = 400;
    private static final Pattern DATA_URL =
            Pattern.compile("^data:image/(\\w+);base64,(.*)$", Pattern.CASE_INSENSITIVE);

    /**
     * 把原图 data URL 转为 {full, thumb}。
     * full = 原图 data URL；thumb = 缩略图 data URL（生成失败时回退为 full，保证可用）。
     */
    public static String[] toFullAndThumb(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            return new String[]{"", ""};
        }
        String thumb = generateThumb(dataUrl);
        return new String[]{dataUrl, thumb != null ? thumb : dataUrl};
    }

    private static String generateThumb(String dataUrl) {
        Matcher m = DATA_URL.matcher(dataUrl);
        if (!m.matches()) return null;
        String base64 = m.group(2);
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(bytes));
            if (src == null) return null;
            int w = src.getWidth(), h = src.getHeight();
            if (w <= 0 || h <= 0) return null;
            int newW = Math.min(w, THUMB_MAX_WIDTH);
            int newH = newW * h / w;
            BufferedImage thumb = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = thumb.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, newW, newH, null);
            g.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(thumb, "jpg", out);  // 缩略图统一 jpeg，压缩省空间
            String thumbBase64 = Base64.getEncoder().encodeToString(out.toByteArray());
            return "data:image/jpeg;base64," + thumbBase64;
        } catch (Exception e) {
            return null;
        }
    }
}
