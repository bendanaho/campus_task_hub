package com.example.keshe_backend.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillItemResponse {
    private Long id;
    private Long userId;
    private String direction;
    private BigDecimal amount;
    private String category;
    private String relatedId;
    private String note;
    private LocalDateTime time;
}
