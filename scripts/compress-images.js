/**
 * 产品图片压缩脚本
 * 用于批量压缩 CloudBase 中的产品图片
 *
 * 使用说明:
 * 1. 首先部署 cloudfunctions/image-compress 云函数
 * 2. 运行此脚本调用云函数进行压缩
 */

const productsToCompress = [
  // 较大的 PNG 图片（约1.7MB）
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772189128437_5r36zyvlmik.png', name: '产品1' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772190450758_pujs5zpy0u.png', name: '产品2' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772190799558_gu42leo7d3i.png', name: '产品3' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772191478609_wds25nrwj3n.png', name: '产品4' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772191950754_mxtk15dqha.png', name: '产品5' },

  // 较大的 JPG 图片（约200-700KB）
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772179987290_zg9vryuv4nk.jpg', name: '产品6' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772195873087_69j92i16o.jpg', name: '产品7' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772195895216_ukmf9pucc.jpg', name: '产品8' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772197050568_0zzrva9dr.jpg', name: '产品9' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772197224401_qx05vj544.jpg', name: '产品10' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772197247070_mv85foo9s.jpg', name: '产品11' },
  { fileID: 'cloud://cloud1-5gh4dyhpb180b5fb.636c-cloud1-5gh4dyhpb180b5fb-1406006729/products/1772198818302_sgcwca7uu.jpg', name: '产品12' },
];

// 在云函数部署后，可以使用以下代码调用:
async function compressImages() {
  try {
    const result = await wx.cloud.callFunction({
      name: 'image-compress',
      data: {
        action: 'compressFile',
        files: productsToCompress.map(p => ({
          fileID: p.fileID,
          maxWidth: 800,
          maxHeight: 800,
          quality: 80
        }))
      }
    });

    console.log('压缩结果:', result);

    if (result.result.code === 0) {
      console.log('压缩成功！');
      result.result.data.forEach(item => {
        if (item.success) {
          console.log(`${item.originalFileID}:`);
          console.log(`  原大小: ${item.originalSize}`);
          console.log(`  压缩后: ${item.compressedSize}`);
          console.log(`  节省: ${item.compressionRatio}`);
        } else {
          console.error(`  失败: ${item.error}`);
        }
      });
    }
  } catch (err) {
    console.error('调用失败:', err);
  }
}

module.exports = { compressImages, productsToCompress };
