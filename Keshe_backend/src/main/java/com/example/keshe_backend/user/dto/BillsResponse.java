package com.example.keshe_backend.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillsResponse {
    private List<BillItemResponse> list;
    private BigDecimal totalIn;
    private BigDecimal totalOut;
}
