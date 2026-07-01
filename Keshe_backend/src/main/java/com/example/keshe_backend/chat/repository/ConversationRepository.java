package com.example.keshe_backend.chat.repository;

import com.example.keshe_backend.chat.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConversationRepository extends JpaRepository<Conversation, String> {

    List<Conversation> findByUser1IdOrUser2IdOrderByLastTimeDesc(Long user1Id, Long user2Id);
}
