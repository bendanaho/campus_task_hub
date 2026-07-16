package com.example.keshe_backend.auth.dto;

import com.example.keshe_backend.user.dto.SafeUserDTO;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {

    private SafeUserDTO user;

    private String token;
}