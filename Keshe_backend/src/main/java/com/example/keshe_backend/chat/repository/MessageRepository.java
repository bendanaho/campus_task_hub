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

    @Modifying
    @Query("UPDATE Message m SET m.read = true WHERE m.chatId = :chatId AND m.senderId != :userId AND m.senderId IS NOT NULL AND m.read = false")
    int markMessagesRead(@Param("chatId") String chatId, @Param("userId") Long userId);
}
