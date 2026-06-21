/**
 * libtv-cli.cjs — LibTV CLI 高级封装模块
 * 
 * 相比旧的 libtvGenVideo/libtvGenImage，此模块增加：
 * 1. 智能 Prompt 构建（主题→丰富描述）
 * 2. 模型自动搜索与选择
 * 3. 引用素材上传（已有素材时）
 * 4. 分镜模式（多段生成+拼接）
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
