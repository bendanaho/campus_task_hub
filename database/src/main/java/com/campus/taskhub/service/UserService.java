package com.campus.taskhub.service;

import com.campus.taskhub.dto.LoginRequest;
import com.campus.taskhub.dto.LoginResponse;
import com.campus.taskhub.dto.RegisterRequest;

public interface UserService {

    void register(RegisterRequest request);

    LoginResponse login(LoginRequest request);
}