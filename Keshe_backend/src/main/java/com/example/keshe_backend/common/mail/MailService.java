package com.example.keshe_backend.common.mail;

import com.example.keshe_backend.common.api.ErrorCode;
import com.example.keshe_backend.common.exception.BusinessException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

/**
 * 发信。走外部 SMTP 中继（smtp.qq.com:465），因为阿里云封禁 25 端口出站，自建邮件服务器不可行。
 *
 * 刻意只发纯文本、不发 HTML：验证码类邮件带 HTML 更容易被判成营销邮件，进垃圾箱或触发风控封授权码。
 */
@Service
@RequiredArgsConstructor
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;

    /** 发件地址：必须与 SMTP 认证账号一致，否则 QQ 会拒收（550）。 */
    @Value("${spring.mail.username}")
    private String from;

    @Value("${app.mail.from-name:校园互助平台}")
    private String fromName;

    public void sendResetCode(String to, String code, int ttlMinutes) {
        String text = "你正在找回【校园互助平台】的账号密码。\n\n"
                + "验证码：" + code + "\n\n"
                + "有效期 " + ttlMinutes + " 分钟，请勿转发给任何人。\n"
                + "如果这不是你本人的操作，忽略本邮件即可，你的密码不会有任何变化。\n";
        send(to, "【校园互助平台】找回密码验证码", text);
    }

    private void send(String to, String subject, String text) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(new InternetAddress(from, fromName, StandardCharsets.UTF_8.name()));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false);
            mailSender.send(message);
        } catch (UnsupportedEncodingException e) {
            // 发件人显示名编码失败属于配置问题，不该让用户看到细节
            log.error("构造发件人失败", e);
            throw new BusinessException(ErrorCode.MAIL_SEND_FAILED);
        } catch (Exception e) {
            // 收件地址是用户自己填的，投递失败很常见（域名不存在/对方拒收）。
            // 日志里不打 to 的完整地址，避免把用户邮箱写进日志文件。
            log.warn("邮件发送失败，收件域名={}", to == null ? "?" : to.substring(Math.max(0, to.indexOf('@'))), e);
            throw new BusinessException(ErrorCode.MAIL_SEND_FAILED);
        }
    }
}
