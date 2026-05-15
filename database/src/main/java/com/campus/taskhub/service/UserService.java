package com.campus.taskhub.service;

import com.campus.taskhub.dto.RegisterRequest;
import com.campus.taskhub.dto.UserResponse;

public interface UserService {

    UserResponse register(RegisterRequest request);
}
