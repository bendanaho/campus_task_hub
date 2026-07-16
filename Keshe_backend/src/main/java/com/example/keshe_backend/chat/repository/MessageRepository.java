package com.example.keshe_backend.chat.repository;

import com.example.keshe_backend.chat.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByChatIdOrderByTimeAsc(String chatId);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.chatId = :chatId AND m.senderId != :userId AND m.senderId IS NOT NULL AND m.read = false")
    long countUnreadByChatIdAndUserId(@Param("chatId") String chatId, @Param("userId") Long userId);

    /**
     * 一次性算出多个会话各自的未读数，替代"每个会话查一次 COUNT"的 N+1。
     * 返回 [chatId, count] 行；未读为 0 的会话不会出现在结果里。
     */
    @Query("SELECT m.chatId, COUNT(m) FROM Message m WHERE m.chatId IN :chatIds " +
           "AND m.senderId != :userId AND m.senderId IS NOT NULL AND m.read = false GROUP BY m.chatId")
    List<Object[]> countUnreadGroupedByChatId(@Param("chatIds") List<String> chatIds, @Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Message m SET m.read = true WHERE m.chatId = :chatId AND m.senderId != :userId AND m.senderId IS NOT NULL AND m.read = false")
    int markMessagesRead(@Param("chatId") String chatId, @Param("userId") Long userId);
}
