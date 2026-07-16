package com.example.keshe_backend.chat.repository;

import com.example.keshe_backend.chat.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, String> {

    List<Conversation> findByUser1IdOrUser2IdOrderByLastTimeDesc(Long user1Id, Long user2Id);

    /**
     * 按业务键找会话：(任务, 双方) 唯一确定一条会话，与双方谁是 user1/user2 无关。
     * 这是会话的真正身份——chatId 只是它的名字，不能拿来当身份用。
     */
    @Query("SELECT c FROM Conversation c WHERE c.taskId = :taskId AND " +
           "((c.user1Id = :a AND c.user2Id = :b) OR (c.user1Id = :b AND c.user2Id = :a))")
    Optional<Conversation> findByTaskIdAndPair(@Param("taskId") Long taskId,
                                               @Param("a") Long a, @Param("b") Long b);
}
