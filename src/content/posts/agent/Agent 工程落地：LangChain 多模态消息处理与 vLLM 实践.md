---
title: "Agent 工程落地：LangChain 多模态消息处理与 vLLM 实践"
author: "myhron <moyueheng@gmail.com>"
date: "2025-01"
description: "深入探讨在 LangChain 生态中如何正确保存和传递多模态数据，特别是在 vLLM 和对象存储场景下的最佳实践"
tags: ["LangChain", "vLLM", "Agent", "多模态", "S3"]
draft: false
published: 2026-01-07
---

# Agent 工程落地：LangChain 多模态消息处理与 vLLM 实践

---

## 目录

- [引言：Agent 多模态化的挑战](#引言agent-多模态化的挑战)
- [核心问题：消息中的"制品"该放在哪](#核心问题消息中的制品该放在哪)
- [LangChain 消息系统深度解析](#langchain-消息系统深度解析)
- [vLLM + S3 架构设计](#vllm--s3-架构设计)
- [生产环境最佳实践](#生产环境最佳实践)
- [完整实现示例](#完整实现示例)
- [总结](#总结)

---

## 引言：Agent 多模态化的挑战

随着 Agent 系统在生产环境中的广泛应用，一个关键问题逐渐浮出水面：**如何在 LangChain 生态中正确保存和传递多模态数据？**

### 实际场景

想象一个真实的 Agent 应用场景：

```
用户: "我遇到了这个错误（上传截图），请查文档帮我解决"

Agent 需要处理:
1. 用户上传的截图 → 多模态 LLM 视觉理解
2. 技术文档 → RAG 检索相关内容
3. 工具执行结果 → 保留完整数据但只传摘要给 LLM
4. 多轮对话历史 → 所有数据需要持久化
```

这个场景暴露了几个核心问题：

- **截图放在哪？** - HumanMessage 的 content？还是 additional_kwargs？
- **文档怎么处理？** - 直接传给 LLM？还是用 RAG？
- **工具返回的大数据怎么办？** - 模型输出太大怎么处理？
- **对话历史怎么持久化？** - 多模态数据如何序列化？

本文将深入探讨这些问题，并提供生产级的解决方案。

---

## 核心问题：消息中的"制品"该放在哪

在 LangChain 中，"制品"（Artifacts）指的是工具执行产生的、不需要发送给 LLM 但需要在其他环节使用的数据。比如：

- 工具生成的图片（base64 编码）
- 数据库查询的完整结果
- 文件处理的详细输出
- 需要在 UI 展示的复杂数据

### 关键区别：content vs artifact

`★ Insight ─────────────────────────────────────`
**LangChain 消息系统的核心设计**
1. **content** - 发送给 LLM 的消息内容（会被计算 token）
2. **artifact** - 工具执行的完整结果（不发送给 LLM）
3. **两者都会被序列化** - 使用 `message_to_dict/messages_from_dict` 持久化
`─────────────────────────────────────────────────`

### 消息类型对比

| 消息类型 | 文件存储位置 | 是否发送给 LLM | 典型用途 |
|---------|------------|---------------|---------|
| **HumanMessage** | `content: list[ContentBlock]` | ✅ 是 | 用户上传的图片/文件 |
| **AIMessage** | `content: list[ContentBlock]` | ✅ 是 | AI 生成的多模态内容 |
| **ToolMessage** | `artifact: Any` | ❌ 否 | 工具执行的完整结果 |

---

## LangChain 消息系统深度解析

### 1. HumanMessage：用户上传的文件

在 LangChain 中，`content` 字段的类型是 `str | list[str | dict]`。当用户上传文件时，`content` 是一个列表，包含多个 ContentBlock：

```python
from langchain_core.messages import HumanMessage

# 用户上传图片 + 文本
message = HumanMessage(
    content=[
        "请描述这张图片",  # 文本
        {
            "type": "image",
            "url": "https://s3.../photo.jpg",
            "mime_type": "image/jpeg"
        }
    ]
)

# 序列化（文件信息完整保存）
from langchain_core.messages import message_to_dict
serialized = message_to_dict(message)
# {
#     "type": "human",
#     "content": [
#         "请描述这张图片",
#         {"type": "image", "url": "...", "mime_type": "image/jpeg"}
#     ]
# }
```

**关键点**：
- ✅ 文件信息会随消息一起序列化
- ✅ 文件会发送给多模态 LLM
- ✅ 适合用户上传的图片、短视频等视觉内容

### 2. ToolMessage：工具执行的制品

`ToolMessage` 有一个特殊的 `artifact` 字段，专门用于存储不发送给 LLM 的完整数据：

```python
from langchain_core.messages import ToolMessage
from langchain_core.tools import tool

@tool(response_format="content_and_artifact")
def query_database(sql: str) -> tuple[str, dict]:
    """查询数据库并返回结果"""
    results = execute_sql(sql)  # 假设返回 1000 条记录

    # content: 发送给 LLM 的摘要
    # artifact: 完整的查询结果
    return f"查询返回 {len(results)} 条记录", {
        "sql": sql,
        "rows": results,
        "columns": list(results[0].keys()) if results else []
    }

# 当工具被调用时，创建 ToolMessage
# ToolMessage(
#     content="查询返回 1000 条记录",  # ✅ 发送给 LLM
#     artifact={完整结果},             # ❌ 不发送给 LLM
#     tool_call_id="call_123"
# )
```

**关键点**：
- ✅ artifact 会随消息一起序列化
- ❌ artifact 不会发送给 LLM（节省 token）
- ✅ 适合工具产生的大数据、二进制数据等

### 3. 消息序列化机制

LangChain 使用 `message_to_dict` 和 `messages_from_dict` 进行序列化：

```python
from langchain_core.messages import (
    message_to_dict,
    messages_from_dict,
    HumanMessage,
    ToolMessage,
)

# 创建带文件的用户消息
user_msg = HumanMessage(
    content=[
        "分析这个",
        {"type": "image", "url": "s3://.../img.jpg"}
    ]
)

# 创建带 artifact 的工具消息
tool_msg = ToolMessage(
    content="处理完成",
    artifact={"image_data": "base64..."},
    tool_call_id="call_123"
)

# 序列化（所有数据都会被保存）
serialized = [message_to_dict(user_msg), message_to_dict(tool_msg)]

# 保存到文件
import json
with open("history.json", "w") as f:
    json.dump(serialized, f)

# 反序列化（完整恢复）
with open("history.json", "r") as f:
    data = json.load(f)

messages = messages_from_dict(data)
# ✅ user_msg.content 中的图片信息完整
# ✅ tool_msg.artifact 中的完整数据保留
```

---

## vLLM + S3 架构设计

在开源模型（vLLM）场景下，多模态数据处理有其特殊性。vLLM 提供了 OpenAI 兼容 API，支持图片、音频、视频等多模态输入。

### 核心挑战

1. **文件存储** - vLLM 需要能访问用户上传的文件
2. **URL 生成** - 预签名 URL vs Base64 编码
3. **大文档处理** - PDF/Word 如何高效检索
4. **缓存优化** - 避免重复传输相同文件

### 推荐架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户输入                              │
│              (文本 + 文件上传)                            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              智能文件分类器                                │
│  • 图片/短视频 → DIRECT_LLM                               │
│  • 长文档 → RAG_RETRIEVAL                                │
│  • 音频 → TRANSCRIPTION                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐     ┌──────────────┐
│  视觉内容      │     │   文档内容    │
│  (图片/视频)   │     │  (PDF/Word)  │
└───────┬───────┘     └──────┬───────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌──────────────┐
│ 上传到 S3     │     │  上传到 S3   │
│ 生成预签名URL │     │  存入向量库  │
└───────┬───────┘     └──────┬───────┘
        │                     │
        ▼                     ▼
┌───────────────┐     ┌──────────────┐
│ HumanMessage  │     │  RAG 工具    │
│ content=[图片] │     │  检索片段    │
└───────┬───────┘     └──────┬───────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                    vLLM 推理                             │
│  • 接收多模态消息                                         │
│  • 接收 RAG 检索的文档片段                                │
│  • 生成响应                                              │
└─────────────────────────────────────────────────────────┘
```

### 实现要点

#### 1. 文件分类策略

```python
from enum import Enum

class ProcessingStrategy(str, Enum):
    DIRECT_LLM = "direct_llm"       # 直接传给 vLLM
    RAG_RETRIEVAL = "rag_retrieval" # RAG 检索
    TRANSCRIPTION = "transcription" # 转录
    IGNORE = "ignore"               # 忽略

def classify_file(file_path: str, file_size: int) -> ProcessingStrategy:
    """根据文件类型和大小决定处理策略"""
    mime_type = mimetypes.guess_type(file_path)[0]

    # 图片 < 5MB → 直接传给 vLLM
    if mime_type.startswith("image/") and file_size < 5 * 1024 * 1024:
        return ProcessingStrategy.DIRECT_LLM

    # PDF/Word → RAG 检索
    if mime_type in ["application/pdf", "application/msword"]:
        return ProcessingStrategy.RAG_RETRIEVAL

    # 音频 → 转录
    if mime_type.startswith("audio/"):
        return ProcessingStrategy.TRANSCRIPTION

    return ProcessingStrategy.IGNORE
```

#### 2. S3 预签名 URL 生成

```python
import boto3

class S3FileManager:
    """S3 文件管理器"""

    def __init__(self, bucket_name: str):
        self.s3_client = boto3.client('s3')
        self.bucket_name = bucket_name

    def upload_file(self, file_path: str) -> str:
        """上传文件到 S3，返回 s3_key"""
        s3_key = f"uploads/{uuid.uuid4()}/{Path(file_path).name}"
        self.s3_client.upload_file(
            file_path,
            self.bucket_name,
            s3_key,
            ExtraArgs={'ContentType': mimetypes.guess_type(file_path)[0]}
        )
        return s3_key

    def get_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """生成预签名 URL（vLLM 会用这个 URL 下载文件）"""
        return self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket_name, 'Key': s3_key},
            ExpiresIn=expires_in
        )
```

#### 3. 构建多模态消息

```python
from langchain_core.messages import HumanMessage

def create_multimodal_message(
    text: str,
    files: list[str],
    s3_manager: S3FileManager
) -> HumanMessage:
    """创建带文件的多模态消息"""
    content = [text]

    for file_path in files:
        # 上传到 S3
        s3_key = s3_manager.upload_file(file_path)

        # 生成预签名 URL
        url = s3_manager.get_presigned_url(s3_key)

        # 添加到 content
        content.append({
            "type": "image_url",
            "image_url": {
                "url": url,
                "uuid": s3_key  # vLLM 缓存用
            }
        })

    return HumanMessage(content=content)
```

#### 4. vLLM 集成

```python
from langchain_openai import ChatOpenAI

# vLLM 提供了 OpenAI 兼容 API
llm = ChatOpenAI(
    base_url="http://localhost:8000/v1",  # vLLM 服务器
    api_key="EMPTY",                        # vLLM 不需要 key
    model="microsoft/Phi-3.5-vision-instruct"
)

# 调用
message = create_multimodal_message(
    "这是什么？",
    ["./image.jpg"],
    s3_manager
)

response = llm.invoke([message])
```

---

## 生产环境最佳实践

### 1. 文件大小控制

```python
# 配置合理的阈值
FILE_SIZE_LIMITS = {
    "direct_llm_max_size": 5 * 1024 * 1024,      # 5MB - 直接传给 vLLM
    "base64_max_size": 500 * 1024,              # 500KB - 使用 Base64
    "rag_min_text_length": 500,                 # 500 字符 - 使用 RAG
}

def should_use_presigned_url(file_size: int) -> bool:
    """判断是否应该使用预签名 URL"""
    return file_size > FILE_SIZE_LIMITS["base64_max_size"]
```

### 2. 缓存策略

```python
# vLLM 支持 UUID 缓存，避免重复传输
content.append({
    "type": "image_url",
    "image_url": {
        "url": presigned_url,
        "uuid": s3_key  # 使用 s3_key 作为 UUID
    }
})
```

### 3. 安全配置

```bash
# 启动 vLLM 时限制可访问的域名
vllm serve ... \
  --allowed-media-domains s3.amazonaws.com *.s3.amazonaws.com \
  --allowed-local-media-path /data/uploads
```

### 4. 对话历史持久化

```python
from langchain_core.chat_history import FileChatMessageHistory

class S3ChatHistory(FileChatMessageHistory):
    """支持多模态消息的对话历史"""

    def add_messages(self, messages):
        """添加消息 - 自动处理预签名 URL 过期"""
        # 获取现有消息
        all_messages = list(self.messages) + list(messages)

        # 重新生成过期的预签名 URL
        for msg in all_messages:
            if isinstance(msg.content, list):
                for item in msg.content:
                    if isinstance(item, dict) and "image_url" in item:
                        url = item["image_url"]["url"]
                        if self._is_url_expired(url):
                            # 重新生成
                            s3_key = item["image_url"]["uuid"]
                            new_url = s3_manager.get_presigned_url(s3_key)
                            item["image_url"]["url"] = new_url

        # 序列化保存
        serialized = [message_to_dict(msg) for msg in all_messages]
        with open(self.file_path, "w") as f:
            json.dump(serialized, f)
```

### 5. 错误处理

```python
from typing import Optional

def safe_create_message(
    text: str,
    files: list[str],
    s3_manager: S3FileManager
) -> Optional[HumanMessage]:
    """安全创建多模态消息，带错误处理"""
    try:
        content = [text]

        for file_path in files:
            try:
                # 上传到 S3
                s3_key = s3_manager.upload_file(file_path)

                # 生成预签名 URL
                url = s3_manager.get_presigned_url(s3_key)

                content.append({
                    "type": "image_url",
                    "image_url": {"url": url}
                })

            except Exception as e:
                # 单个文件失败不影响其他文件
                logger.error(f"Failed to process {file_path}: {e}")
                content.append(f"[文件 {file_path} 处理失败]")

        return HumanMessage(content=content)

    except Exception as e:
        logger.error(f"Failed to create message: {e}")
        return None
```

---

## 完整实现示例

### Agent 应用类

```python
from typing import Any, Dict, List
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

class MultimodalAgent:
    """多模态 Agent 实现"""

    def __init__(
        self,
        s3_bucket: str,
        vllm_base_url: str = "http://localhost:8000/v1",
        model: str = "microsoft/Phi-3.5-vision-instruct"
    ):
        self.s3_manager = S3FileManager(bucket_name=s3_bucket)
        self.llm = ChatOpenAI(
            base_url=vllm_base_url,
            api_key="EMPTY",
            model=model
        )
        self.history = FileChatMessageHistory(
            session_id="default",
            file_path="./chat_history.json"
        )
        self.tools = self._create_tools()

    def _create_tools(self):
        """创建 Agent 工具"""

        @tool(response_format="content_and_artifact")
        def search_document(query: str, s3_key: str) -> tuple[str, dict]:
            """在文档中搜索相关内容"""
            # 1. 从 S3 下载文档
            url = self.s3_manager.get_presigned_url(s3_key)

            # 2. 解析文档并检索
            docs = vectorstore.similarity_search(query, k=3)

            # 3. 返回结果
            return f"找到 {len(docs)} 条相关内容", {
                "query": query,
                "documents": [doc.dict() for doc in docs],
                "s3_key": s3_key
            }

        return [search_document]

    def chat(
        self,
        text: str,
        files: List[str] | None = None
    ) -> str:
        """主对话接口"""
        # 1. 创建多模态消息
        content = [text]

        if files:
            for file_path in files:
                # 上传到 S3
                s3_key = self.s3_manager.upload_file(file_path)
                url = self.s3_manager.get_presigned_url(s3_key)

                # 添加到 content
                mime_type = mimetypes.guess_type(file_path)[0]

                if mime_type.startswith("image/"):
                    # 图片 → 直接传给 vLLM
                    content.append({
                        "type": "image_url",
                        "image_url": {
                            "url": url,
                            "uuid": s3_key
                        }
                    })
                elif mime_type == "application/pdf":
                    # PDF → 使用 RAG 工具
                    content.append(
                        f"文档已上传: {s3_key}，请使用工具搜索相关内容"
                    )

        # 2. 添加到历史
        user_msg = HumanMessage(content=content)
        self.history.add_messages([user_msg])

        # 3. 调用 LLM
        messages = self.history.messages

        # 如果有文档，使用工具
        if any("文档已上传" in str(msg.content) for msg in messages):
            llm_with_tools = self.llm.bind_tools(self.tools)
            response = llm_with_tools.invoke(messages)
        else:
            response = self.llm.invoke(messages)

        # 4. 保存响应
        self.history.add_messages([response])

        return response.content

# 使用示例
agent = MultimodalAgent(s3_bucket="my-multimodal-bucket")

# 场景 1：纯文本
response = agent.chat("你好")

# 场景 2：图片
response = agent.chat(
    "这是什么？",
    files=["./image.jpg"]
)

# 场景 3：图片 + 文档
response = agent.chat(
    "我遇到了这个错误，请查文档",
    files=["./error.png", "./manual.pdf"]
)
```

---

## 总结

在生产环境的 Agent 应用中，多模态数据处理的核心要点：

### 设计原则

1. **文件分类处理**
   - 图片/短视频 → 直接传给 vLLM（`content`）
   - 长文档 → RAG 检索（工具）
   - 工具大数据 → artifact

2. **存储策略**
   - 使用 S3 存储文件
   - 预签名 URL 用于 vLLM 访问
   - Base64 用于小文件（< 500KB）

3. **持久化机制**
   - `message_to_dict/messages_from_dict` 序列化
   - HumanMessage 文件在 `content` 列表中
   - ToolMessage 大数据在 `artifact` 字段

### 关键区别

| 场景 | 存储位置 | 发送给 LLM | 示例 |
|------|---------|-----------|------|
| 用户上传图片 | `HumanMessage.content` | ✅ 是 | 截图分析 |
| 用户上传文档 | 引用 + RAG 工具 | 部分 | 文档检索 |
| 工具生成图片 | `ToolMessage.artifact` | ❌ 否 | 图表生成 |
| 工具查询结果 | `ToolMessage.artifact` | ❌ 否 | 数据库查询 |

### 最佳实践

✅ **推荐做法**

```python
# 1. 使用预签名 URL（大文件）
content.append({
    "type": "image_url",
    "image_url": {"url": presigned_url, "uuid": s3_key}
})

# 2. 工具返回摘要 + 完整数据
return "查询完成", {full_results}

# 3. 序列化时保留所有数据
serialized = message_to_dict(message)  # artifact 也会被保存
```

❌ **避免做法**

```python
# 1. 不要把大文档放在 content 中
message = HumanMessage(content=[large_pdf_content])

# 2. 不要忽略文件类型分类
all_files_directly_to_llm = False

# 3. 不要忘记序列化 artifact
# artifact 会自动被 message_to_dict 保存
```

### 参考资料

- [LangChain 消息系统](https://python.langchain.com/docs/concepts/#messages)
- [vLLM 多模态文档](https://docs.vllm.ai/en/stable/features/multimodal_inputs.html)
- [Tool Output Format](https://python.langchain.com/docs/how_to/tool_calls/#passing-tool-outputs-to-the-model)

---

**感谢阅读！本文详细介绍了在 Agent 工程落地中，如何使用 LangChain 处理多模态数据，特别是在 vLLM 和对象存储场景下的最佳实践。**

*记住：content 发送给 LLM，artifact 不发送；两者都会被序列化。根据场景选择正确的存储方式！*
