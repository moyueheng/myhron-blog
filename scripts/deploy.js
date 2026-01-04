#!/usr/bin/env node

import { execSync } from 'child_process';
import readline from 'readline';

/**
 * 解析 esa-cli deployments list 的输出
 * 提取所有非活跃的版本 ID
 */
function parseDeploymentsList(output) {
  const lines = output.split('\n');
  const versions = [];

  // 跳过表头和分隔线，查找版本数据
  // 格式: │ Version                           │ Created             │ Description │
  for (const line of lines) {
    // 匹配版本行（以 │ 开头，包含数字）
    const versionMatch = line.match(/\|\s*(\d{16,})\s*\|/);
    if (versionMatch) {
      const versionId = versionMatch[1];
      // 排除活跃版本（包含 "Active" 标记的行）
      if (!line.includes('Active')) {
        versions.push(versionId);
      }
    }
  }

  return versions;
}

/**
 * 执行命令并返回输出
 */
function execCommand(command, silent = false) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return output;
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始部署流程...\n');

  // 1. 获取部署列表
  console.log('📋 获取现有部署列表...');
  const deploymentsOutput = execCommand('esa-cli deployments list', true);

  // 2. 解析并获取要删除的旧版本
  const oldVersions = parseDeploymentsList(deploymentsOutput);
  console.log(`找到 ${oldVersions.length} 个非活跃版本\n`);

  // 3. 删除最旧的 3 个版本
  const versionsToDelete = oldVersions.slice(0, 3);

  if (versionsToDelete.length > 0) {
    console.log(`🗑️  准备删除 ${versionsToDelete.length} 个旧版本:`);
    versionsToDelete.forEach((v, i) => console.log(`   ${i + 1}. ${v}`));
    console.log();

    const deleteCommand = `esa-cli deployments delete ${versionsToDelete.join(' ')}`;
    execCommand(deleteCommand);
    console.log('✅ 旧版本删除完成\n');
  } else {
    console.log('ℹ️  没有需要删除的旧版本\n');
  }

  // 4. 执行部署
  console.log('📦 开始部署...');
  execCommand('esa-cli deploy');

  console.log('\n✨ 部署流程完成!');
}

main().catch((error) => {
  console.error('❌ 部署失败:', error.message);
  process.exit(1);
});
