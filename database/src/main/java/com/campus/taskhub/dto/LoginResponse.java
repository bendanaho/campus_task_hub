package com.campus.taskhub.dto;

import lombok.Data;

@Data
public class LoginResponse {

    private String token;

    private UserResponse user;
}
