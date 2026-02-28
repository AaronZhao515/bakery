/**
 * 图片压缩云函数
 * 用于批量压缩云存储中的产品图片并直接替换原图
 */
const cloud = require('wx-server-sdk')
const Jimp = require('jimp')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const MAX_WIDTH = 800
const MAX_HEIGHT = 800
const JPEG_QUALITY = 80

exports.main = async (event, context) => {
  const { action, files, fileIDs } = event

  try {
    switch (action) {
      case 'compressAndReplace':
        return await compressAndReplace(files)
      case 'checkFileSizes':
        return await checkFileSizes(fileIDs)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    console.error('图片压缩错误:', err)
    return { code: -1, message: err.message }
  }
}

/**
 * 压缩图片并替换原图
 * @param {Array} fileList - 要压缩的文件列表 [{ fileID, collection, docId, field }]
 */
async function compressAndReplace(fileList) {
  if (!fileList || fileList.length === 0) {
    return { code: -1, message: '请提供要压缩的文件列表' }
  }

  const results = []

  for (const fileInfo of fileList) {
    try {
      const {
        fileID,
        collection = 'products',
        docId,
        field = 'image',
        maxWidth = MAX_WIDTH,
        maxHeight = MAX_HEIGHT,
        quality = JPEG_QUALITY
      } = fileInfo

      console.log(`处理文件: ${fileID}`)

      // 1. 下载原文件
      const downloadRes = await cloud.downloadFile({
        fileID: fileID
      })

      const buffer = downloadRes.fileContent
      const originalSize = buffer.length

      // 2. 使用 Jimp 读取图片
      const image = await Jimp.read(buffer)
      const originalWidth = image.getWidth()
      const originalHeight = image.getHeight()

      // 3. 判断是否需要压缩
      let needsCompression = false
      let compressedBuffer = buffer

      // 如果图片尺寸超过限制，需要压缩
      if (originalWidth > maxWidth || originalHeight > maxHeight) {
        needsCompression = true
        image.resize(maxWidth, maxHeight, Jimp.RESIZE_BILINEAR)
      }

      // 4. 获取图片格式
      const mimeType = image.getMIME()
      const isPNG = mimeType === Jimp.MIME_PNG
      const isJPEG = mimeType === Jimp.MIME_JPEG || mimeType === Jimp.MIME_JPG

      // 5. 压缩图片
      if (isPNG) {
        // PNG 使用最高压缩级别
        compressedBuffer = await image.quality(100).getBufferAsync(Jimp.MIME_PNG)
      } else if (isJPEG) {
        // JPEG 使用指定质量
        compressedBuffer = await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG)
      } else {
        // 其他格式转为 JPEG
        compressedBuffer = await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG)
      }

      const compressedSize = compressedBuffer.length
      const compressionRatio = originalSize > 0
        ? ((originalSize - compressedSize) / originalSize * 100).toFixed(2)
        : 0

      // 如果压缩后更大，跳过
      if (compressedSize >= originalSize) {
        results.push({
          fileID: fileID,
          success: true,
          skipped: true,
          reason: '压缩后文件更大，已跳过',
          originalSize: formatBytes(originalSize),
          compressedSize: formatBytes(compressedSize)
        })
        continue
      }

      // 6. 提取原文件的 cloudPath
      const fileName = fileID.split('/').pop()
      const originalCloudPath = `products/${fileName}`

      // 7. 先上传压缩后的图片到原位置（使用相同的 cloudPath）
      const uploadRes = await cloud.uploadFile({
        cloudPath: originalCloudPath,
        fileContent: compressedBuffer
      })

      console.log(`已上传压缩文件: ${uploadRes.fileID}`)

      // 8. 上传成功后，删除原文件
      try {
        await cloud.deleteFile({
          fileList: [fileID]
        })
        console.log(`已删除原文件: ${fileID}`)
      } catch (deleteErr) {
        console.error(`删除原文件失败: ${deleteErr.message}`)
        // 上传已成功，删除失败不影响结果
      }

      // 9. 更新数据库中的图片引用
      if (docId && collection) {
        try {
          // 获取当前文档
          const docRes = await db.collection(collection).doc(docId).get()
          const doc = docRes.data

          if (doc) {
            // 构建更新数据
            const updateData = {
              updateTime: db.serverDate()
            }

            if (field === 'images' && Array.isArray(doc.images)) {
              // 多图场景：替换数组中的旧 fileID
              const oldIndex = doc.images.indexOf(fileID)
              if (oldIndex !== -1) {
                updateData[`images.${oldIndex}`] = uploadRes.fileID
              } else {
                // 如果找不到旧 fileID，可能是 images 字段存储方式不同
                // 尝试替换整个 images 数组
                updateData.images = doc.images.map(img => img === fileID ? uploadRes.fileID : img)
              }
            } else {
              // 单图场景：直接更新字段
              updateData[field || 'image'] = uploadRes.fileID
            }

            await db.collection(collection).doc(docId).update({ data: updateData })
            console.log(`已更新数据库: ${collection}.${docId}`)
          }
        } catch (dbErr) {
          console.error(`更新数据库失败: ${dbErr.message}`)
        }
      }

      // 注意：订单不再存储图片，只存 productId，图片实时从 products 获取
      // 所以不需要更新 orders 集合

      results.push({
        originalFileID: fileID,
        newFileID: uploadRes.fileID,
        originalSize: formatBytes(originalSize),
        compressedSize: formatBytes(compressedSize),
        compressionRatio: `${compressionRatio}%`,
        dimensions: `${originalWidth}x${originalHeight}`,
        cloudPath: originalCloudPath,
        success: true
      })

    } catch (err) {
      console.error(`处理文件失败: ${fileInfo.fileID}`, err)
      results.push({
        fileID: fileInfo.fileID,
        error: err.message,
        success: false
      })
    }
  }

  // 计算总体压缩统计
  const successfulResults = results.filter(r => r.success && !r.skipped)
  const totalOriginal = successfulResults.reduce((sum, r) => sum + parseBytes(r.originalSize), 0)
  const totalCompressed = successfulResults.reduce((sum, r) => sum + parseBytes(r.compressedSize), 0)
  const totalSaved = totalOriginal - totalCompressed

  return {
    code: 0,
    message: '压缩完成',
    data: {
      results,
      summary: {
        total: fileList.length,
        success: successfulResults.length,
        failed: results.filter(r => !r.success).length,
        skipped: results.filter(r => r.skipped).length,
        totalOriginalSize: formatBytes(totalOriginal),
        totalCompressedSize: formatBytes(totalCompressed),
        totalSaved: formatBytes(totalSaved),
        savedPercent: totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(2) : 0
      }
    }
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function parseBytes(sizeStr) {
  if (typeof sizeStr === 'number') return sizeStr
  if (!sizeStr) return 0
  const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 }
  const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB)/)
  if (match) {
    return parseFloat(match[1]) * units[match[2]]
  }
  return 0
}

/**
 * 检查文件大小
 * @param {Array} fileIDs - 文件ID列表
 */
async function checkFileSizes(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) {
    return { code: 0, data: [] }
  }

  const results = []

  // 批量处理，每批最多 10 个
  const batchSize = 10
  for (let i = 0; i < fileIDs.length; i += batchSize) {
    const batch = fileIDs.slice(i, i + batchSize)

    const batchResults = await Promise.all(batch.map(async (fileID) => {
      try {
        // 尝试下载文件获取大小
        const downloadRes = await cloud.downloadFile({
          fileID: fileID
        })
        const size = downloadRes.fileContent.length
        return {
          fileID,
          size,
          sizeStr: formatBytes(size)
        }
      } catch (err) {
        console.error(`获取文件大小失败: ${fileID}`, err)
        return {
          fileID,
          size: 0,
          sizeStr: '获取失败'
        }
      }
    }))

    results.push(...batchResults)
  }

  return { code: 0, data: results }
}
