import { LearningSourceType } from '@/features/exes/types';

export async function pickDocumentSource(defaultType: LearningSourceType = 'document') {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    localUri: asset.uri,
    title: asset.name || '导入文件',
    type: defaultType,
  };
}

export async function pickImageSource(defaultType: LearningSourceType = 'image') {
  const sources = await pickImageSources(defaultType, 1);
  return sources[0] ?? null;
}

export async function pickImageSources(defaultType: LearningSourceType = 'image', limit = 9) {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('需要相册权限才能导入照片、截图和表情包');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, Math.min(limit, 9)),
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.92,
  });

  if (result.canceled) {
    return [];
  }

  return result.assets.slice(0, Math.max(1, Math.min(limit, 9))).map((asset, index) => ({
    localUri: asset.uri,
    title: asset.fileName || `导入图片 ${index + 1}`,
    type: defaultType,
  }));
}

export async function pickCameraSource(defaultType: LearningSourceType = 'image') {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('需要相机权限才能拍摄照片');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.92,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  return {
    localUri: asset.uri,
    title: asset.fileName || `拍摄照片 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
    type: defaultType,
  };
}
