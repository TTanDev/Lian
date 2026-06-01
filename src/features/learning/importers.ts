import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { LearningSourceType } from '@/features/exes/types';

export async function pickDocumentSource(defaultType: LearningSourceType = 'document') {
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
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('需要相册权限才能导入照片、截图和表情包');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
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
    title: asset.fileName || '导入图片',
    type: defaultType,
  };
}
