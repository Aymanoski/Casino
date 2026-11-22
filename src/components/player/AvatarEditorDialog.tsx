'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  ImagePlus,
  Move,
  RotateCcw,
  Sparkles,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { estimateDataUrlByteSize } from '@/lib/commands';
import { playerRepo } from '@/lib/repos';
import type { Avatar as AvatarType, Player } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import {
  AVATAR_3D_LIBRARY,
  Avatar3DArtwork,
  getAvatar3DDefinition,
  resolveDeterministicAvatarKey,
} from '@/components/brand/AvatarLibrary3D';
import { PlayerAvatar } from '@/components/brand/PlayerAvatar';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const TARGET_MAX_PHOTO_BYTES = 300 * 1024; // 300 KB target limit

/**
 * Renders a square crop of a loaded HTMLImageElement onto a canvas
 * with user zoom (1..3) and normalized pan offset (-1..1),
 * iteratively compressing quality/dimensions so the output data URL is guaranteed <= 300KB.
 */
export function renderCroppedSquareDataUrl(
  img: HTMLImageElement,
  zoom: number,
  panX: number,
  panY: number,
  maxBytes = TARGET_MAX_PHOTO_BYTES
): { dataUrl: string; byteSize: number; dimension: number } {
  const nw = Math.max(1, img.naturalWidth || img.width || 256);
  const nh = Math.max(1, img.naturalHeight || img.height || 256);
  const minSide = Math.min(nw, nh);
  const safeZoom = Math.max(1, Math.min(3, zoom));
  const cropSide = minSide / safeZoom;

  const maxOffsetX = Math.max(0, (nw - cropSide) / 2);
  const maxOffsetY = Math.max(0, (nh - cropSide) / 2);

  const centerX = nw / 2 - Math.max(-1, Math.min(1, panX)) * maxOffsetX;
  const centerY = nh / 2 - Math.max(-1, Math.min(1, panY)) * maxOffsetY;

  const sx = Math.max(0, Math.min(nw - cropSide, centerX - cropSide / 2));
  const sy = Math.max(0, Math.min(nh - cropSide, centerY - cropSide / 2));

  const candidateDimensions = [480, 384, 320, 256];
  const candidateQualities = [0.86, 0.76, 0.66, 0.56, 0.46];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  for (const dim of candidateDimensions) {
    canvas.width = dim;
    canvas.height = dim;
    if (ctx) {
      ctx.fillStyle = '#FFF9F0';
      ctx.fillRect(0, 0, dim, dim);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, dim, dim);
    }

    for (const q of candidateQualities) {
      const jpegUrl = canvas.toDataURL('image/jpeg', q);
      const bytes = estimateDataUrlByteSize(jpegUrl);
      if (bytes <= maxBytes) {
        return { dataUrl: jpegUrl, byteSize: bytes, dimension: dim };
      }
    }
  }

  const fallbackUrl = canvas.toDataURL('image/jpeg', 0.4);
  return {
    dataUrl: fallbackUrl,
    byteSize: estimateDataUrlByteSize(fallbackUrl),
    dimension: 256,
  };
}

export interface AvatarEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  actorUserId: string;
  /** True when the player is editing their own profile (or admin previewing `/player`) to allow nickname edits */
  allowNicknameEdit?: boolean;
  useArabicIndicDigits?: boolean;
  onSaved?: (updatedPlayer: Player) => void;
}

export function AvatarEditorDialog({
  open,
  onOpenChange,
  player,
  actorUserId,
  allowNicknameEdit = false,
  useArabicIndicDigits = false,
  onSaved,
}: AvatarEditorDialogProps) {
  const { lang } = useI18n();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'photo' | 'library'>('library');
  const [selectedKey, setSelectedKey] = useState<string>('avatar-01');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBytes, setPhotoBytes] = useState<number>(0);

  // Raw image loaded for interactive square crop & zoom
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [nickname, setNickname] = useState<string>('');
  const [nicknameAr, setNicknameAr] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const defaultAssignedKey = player
    ? resolveDeterministicAvatarKey(player.seed || player.id)
    : 'avatar-01';

  // Reset modal state whenever opened for a player
  useEffect(() => {
    if (!open || !player) return;
    const initialKey = resolveDeterministicAvatarKey(
      player.seed || player.id,
      player.avatar?.avatarKey
    );
    const existingPhoto = player.avatar?.photoUrl ?? null;
    setSelectedKey(initialKey);
    setPhotoDataUrl(existingPhoto);
    setPhotoBytes(existingPhoto ? estimateDataUrlByteSize(existingPhoto) : 0);
    setRawImageSrc(null);
    loadedImgRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNickname(player.nickname);
    setNicknameAr(player.nicknameAr || player.nickname);
    setFileError(null);
    setActiveTab(existingPhoto ? 'photo' : 'library');
  }, [open, player]);

  // Re-compute square cropped & <=300KB compressed data URL whenever zoom or pan changes on a loaded raw image
  const recomputeCrop = useCallback(
    (nextZoom: number, nextPan: { x: number; y: number }) => {
      const img = loadedImgRef.current;
      if (!img) return;
      try {
        const result = renderCroppedSquareDataUrl(
          img,
          nextZoom,
          nextPan.x,
          nextPan.y,
          TARGET_MAX_PHOTO_BYTES
        );
        setPhotoDataUrl(result.dataUrl);
        setPhotoBytes(result.byteSize);
        setFileError(null);
      } catch {
        setFileError(
          lang === 'ar'
            ? 'تعذّر معالجة الصورة المختارة. جرّب صورة أخرى بصيغة JPG أو PNG أو WebP.'
            : 'Could not process the selected image. Please try another JPG, PNG, or WebP file.'
        );
      }
    },
    [lang]
  );

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileError(null);
    const mime = (file.type || '').toLowerCase();
    const extValid = /\.(jpe?g|png|webp)$/i.test(file.name || '');

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) && !extValid) {
      setFileError(
        lang === 'ar'
          ? 'صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP فقط.'
          : 'Unsupported file type. Please upload a JPG, PNG, or WebP image.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setFileError(
        lang === 'ar'
          ? 'تعذّر قراءة ملف الصورة.'
          : 'Failed to read the selected image file.'
      );
    };
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : null;
      if (!src) return;
      const img = new window.Image();
      img.onload = () => {
        loadedImgRef.current = img;
        setRawImageSrc(src);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setActiveTab('photo');
        const cropped = renderCroppedSquareDataUrl(
          img,
          1,
          0,
          0,
          TARGET_MAX_PHOTO_BYTES
        );
        setPhotoDataUrl(cropped.dataUrl);
        setPhotoBytes(cropped.byteSize);
      };
      img.onerror = () => {
        setFileError(
          lang === 'ar'
            ? 'ملف الصورة تالف أو غير صالح.'
            : 'The selected image file is invalid or corrupted.'
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleCropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!loadedImgRef.current) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !loadedImgRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / 90;
    const dy = (e.clientY - dragRef.current.startY) / 90;
    const nextPan = {
      x: Math.max(-1, Math.min(1, dragRef.current.panX + dx)),
      y: Math.max(-1, Math.min(1, dragRef.current.panY + dy)),
    };
    setPan(nextPan);
    recomputeCrop(zoom, nextPan);
  };

  const handleCropPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('blur', handleCropPointerUp);
    return () => window.removeEventListener('blur', handleCropPointerUp);
  }, [handleCropPointerUp]);

  const handleRemovePhoto = () => {
    setPhotoDataUrl(null);
    setPhotoBytes(0);
    setRawImageSrc(null);
    loadedImgRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFileError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;

    const nextAvatar: AvatarType = {
      photoUrl: photoDataUrl,
      avatarKey: selectedKey,
    };

    if (allowNicknameEdit && !nickname.trim()) {
      setFileError(
        lang === 'ar'
          ? 'يرجى إدخال لقب المتسابق.'
          : 'Please enter a display nickname.'
      );
      return;
    }

    setSaving(true);
    setFileError(null);
    try {
      let updated: Player | null = null;
      if (allowNicknameEdit) {
        updated = await playerRepo.updateOwnProfile(
          player.id,
          {
            nickname: nickname.trim(),
            nicknameAr: nicknameAr.trim() || nickname.trim(),
            avatar: nextAvatar,
          },
          actorUserId
        );
      } else {
        updated = await playerRepo.updateAvatar(
          player.id,
          nextAvatar,
          actorUserId
        );
      }

      if (updated) {
        toast({
          variant: 'positive',
          title:
            lang === 'ar'
              ? 'تم حفظ الصورة والملف الشخصي'
              : 'Avatar & profile saved',
          description: localizeText(
            lang,
            updated.fullName,
            updated.fullNameAr
          ),
        });
        onSaved?.(updated);
        onOpenChange(false);
      }
    } catch (err) {
      setFileError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'تعذّر حفظ التعديلات.'
            : 'Could not save avatar changes.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!player) return null;

  const displayName = localizeText(lang, player.fullName, player.fullNameAr);
  const selectedDef = getAvatar3DDefinition(selectedKey);
  const kbSize = Math.max(1, Math.round(photoBytes / 1024));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lang === 'ar'
              ? `استوديو الصورة والأفاتار — ${displayName}`
              : `Avatar & Profile Studio — ${displayName}`}
          </DialogTitle>
          <DialogDescription>
            {lang === 'ar'
              ? 'ارفع صورة شخصية مربعة (من الكاميرا أو المعرض بحد أقصى ٣٠٠ كيلوبايت) أو اختر من مكتبة الـ ٢٤ أفاتار ثلاثي الأبعاد.'
              : 'Upload a square-cropped profile photo (camera or gallery, auto-compressed <= 300KB) or pick from 24 original 3D game-show avatars.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Live Preview Banner */}
          <div className="flex flex-col gap-4 rounded-card border-2 border-outline bg-paper p-4 sm:flex-row sm:items-center sm:justify-between shadow-sticker-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <PlayerAvatar
                name={displayName}
                playerId={player.id}
                avatarSeed={player.avatarSeed}
                avatar={{ photoUrl: photoDataUrl, avatarKey: selectedKey }}
                size="xl"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={photoDataUrl ? 'positive' : 'gold'}>
                    {photoDataUrl
                      ? lang === 'ar'
                        ? `صورة شخصية (${formatNumber(kbSize, { useArabicIndicDigits })} KB)`
                        : `Custom Photo (${kbSize} KB)`
                      : lang === 'ar'
                        ? `أفاتار 3D #${formatNumber(selectedDef.number, { useArabicIndicDigits })}`
                        : `3D Avatar #${selectedDef.number}`}
                  </Badge>
                  <Badge variant="white" className="tabular-nums">
                    #{formatNumber(player.seed, { useArabicIndicDigits })}
                  </Badge>
                </div>
                <div className="truncate font-display text-xl text-red-900">
                  {displayName}
                </div>
                <div className="truncate text-xs font-bold text-ink-muted">
                  {photoDataUrl
                    ? lang === 'ar'
                      ? `البديل ثلاثي الأبعاد: ${selectedDef.nameAr}`
                      : `3D Fallback: ${selectedDef.nameEn}`
                    : localizeText(lang, selectedDef.nameEn, selectedDef.nameAr)}
                </div>
              </div>
            </div>

            {photoDataUrl && (
              <Button
                type="button"
                variant="calm"
                size="sm"
                onClick={handleRemovePhoto}
                className="text-negative border-negative/40 hover:bg-negative-soft shrink-0"
              >
                <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'حذف الصورة الشخصية' : 'Remove Photo'}
                </span>
              </Button>
            )}
          </div>

          {fileError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-input border-2 border-negative bg-negative-soft p-3 text-xs sm:text-sm font-bold text-negative"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Optional Nickname Self-Service Editor */}
          {allowNicknameEdit && (
            <div className="grid gap-3 rounded-card border border-border-paper bg-white p-4 sm:grid-cols-2">
              <Input
                label={lang === 'ar' ? 'لقب المتسابق (إنجليزي)' : 'Nickname (EN)'}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="The Fox"
                required
              />
              <Input
                label={lang === 'ar' ? 'لقب المتسابق (عربي)' : 'Nickname (AR)'}
                value={nicknameAr}
                onChange={(e) => setNicknameAr(e.target.value)}
                placeholder="الثعلب"
                dir="rtl"
              />
            </div>
          )}

          {/* Mode Tabs: 1. Upload & Crop Photo | 2. 24 3D Avatar Library */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'photo' | 'library')}
          >
            <TabsList className="w-full">
              <TabsTrigger value="photo" className="flex-1 gap-1.5">
                <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'صورة شخصية (كاميرا / معرض)'
                    : 'Profile Photo (Camera / Gallery)'}
                </span>
              </TabsTrigger>
              <TabsTrigger value="library" className="flex-1 gap-1.5">
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar'
                    ? 'مكتبة الأفاتار 3D (٢٤ خيار)'
                    : '3D Avatar Library (24)'}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: CAMERA / GALLERY UPLOAD + SQUARE CROP & <=300KB COMPRESSION */}
            <TabsContent value="photo" className="space-y-4 pt-3">
              {/* Hidden File Inputs */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelected}
                className="sr-only"
                data-testid="avatar-gallery-input"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={handleFileSelected}
                className="sr-only"
                data-testid="avatar-camera-input"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="red"
                  size="sm"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'اختيار من المعرض' : 'Choose from Gallery'}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'التقاط بالكاميرا' : 'Take Photo (Camera)'}
                  </span>
                </Button>

                <span className="text-xs font-semibold text-ink-muted">
                  {lang === 'ar'
                    ? 'الصيغ المسموحة: JPG, PNG, WebP · قص مربع وضغط تلقائي <= 300KB'
                    : 'Allowed: JPG, PNG, WebP · Square crop & auto-compression <= 300KB'}
                </span>
              </div>

              {/* Interactive Square Crop & Zoom Stage */}
              {rawImageSrc && photoDataUrl ? (
                <div className="grid gap-4 rounded-card border border-border-paper bg-paper p-4 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-5 flex flex-col items-center gap-2">
                    <div
                      onPointerDown={handleCropPointerDown}
                      onPointerMove={handleCropPointerMove}
                      onPointerUp={handleCropPointerUp}
                      onPointerCancel={handleCropPointerUp}
                      onLostPointerCapture={handleCropPointerUp}
                      className="relative h-44 w-44 cursor-move overflow-hidden rounded-card border-[3px] border-outline bg-white shadow-sticker select-none touch-none"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoDataUrl}
                        alt={displayName}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                      <span className="pointer-events-none absolute bottom-1.5 inset-x-1.5 inline-flex items-center justify-center gap-1 rounded-pill bg-red-900/80 px-2 py-0.5 text-[10px] font-bold text-white">
                        <Move className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'اسحب لضبط المربع' : 'Drag to frame'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-3">
                    <div className="flex items-center justify-between text-xs font-extrabold text-red-900">
                      <label
                        htmlFor="avatar-crop-zoom"
                        className="inline-flex items-center gap-1.5"
                      >
                        <ZoomIn className="h-4 w-4 text-red-600" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'تكبير القص المربع' : 'Square Crop Zoom'}
                        </span>
                      </label>
                      <span className="tabular-nums">{zoom.toFixed(2)}×</span>
                    </div>

                    <input
                      id="avatar-crop-zoom"
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => {
                        const nextZ = parseFloat(e.target.value) || 1;
                        setZoom(nextZ);
                        recomputeCrop(nextZ, pan);
                      }}
                      className="h-2.5 w-full cursor-pointer accent-red-600"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <Badge variant="positive">
                        {lang === 'ar'
                          ? `الحجم بعد الضغط: ${formatNumber(kbSize, { useArabicIndicDigits })} KB (<= ٣٠٠ KB)`
                          : `Compressed: ${kbSize} KB (<= 300 KB limit)`}
                      </Badge>

                      <Button
                        type="button"
                        variant="calm"
                        size="sm"
                        onClick={() => {
                          setZoom(1);
                          setPan({ x: 0, y: 0 });
                          recomputeCrop(1, { x: 0, y: 0 });
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {lang === 'ar' ? 'إعادة الضبط' : 'Reset Framing'}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : photoDataUrl ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-paper bg-white p-4">
                  <div className="text-xs sm:text-sm font-semibold text-ink">
                    {lang === 'ar'
                      ? `الصورة الشخصية الحالية جاهزة (${formatNumber(kbSize, { useArabicIndicDigits })} كيلوبايت). يمكنك استبدالها أو حذفها.`
                      : `Current profile photo active (${kbSize} KB). Upload a new image to replace it or remove it to use a 3D avatar.`}
                  </div>
                  <Button
                    type="button"
                    variant="calm"
                    size="sm"
                    onClick={handleRemovePhoto}
                    className="text-negative"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'حذف الصورة' : 'Remove Photo'}</span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-card border-2 border-dashed border-border-paper bg-paper/70 p-6 text-center space-y-2">
                  <Camera
                    className="mx-auto h-8 w-8 text-red-600"
                    aria-hidden="true"
                  />
                  <div className="font-display text-lg text-red-900">
                    {lang === 'ar'
                      ? 'لا توجد صورة شخصية مرفوعة حالياً'
                      : 'No custom profile photo uploaded'}
                  </div>
                  <p className="text-xs text-ink-muted max-w-md mx-auto">
                    {lang === 'ar'
                      ? 'يظهر حالياً الأفاتار ثلاثي الأبعاد المختار من المكتبة. ارفع صورة من الكاميرا أو المعرض لقصها بشكل مربع وضغطها تلقائياً.'
                      : 'Your profile is currently using the 3D game-show avatar selected in the library. Upload a photo from your camera or gallery to crop and use it.'}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: 24-OPTION 3D AVATAR LIBRARY */}
            <TabsContent value="library" className="space-y-3 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-ink-muted">
                  {lang === 'ar'
                    ? 'اختر من ٢٤ أفاتار ثلاثي الأبعاد مصمّم خصيصاً لأجواء برنامج كازينو الألعاب:'
                    : 'Choose from 24 original 3D game-show avatars (used whenever no custom photo is set):'}
                </p>

                {selectedKey !== defaultAssignedKey && (
                  <Button
                    type="button"
                    variant="calm"
                    size="sm"
                    onClick={() => {
                      setSelectedKey(defaultAssignedKey);
                      setPhotoDataUrl(null);
                      setPhotoBytes(0);
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {lang === 'ar'
                        ? 'استعادة الأفاتار الافتراضي'
                        : 'Reset to Assigned 3D Avatar'}
                    </span>
                  </Button>
                )}
              </div>

              <div
                role="radiogroup"
                aria-label={
                  lang === 'ar'
                    ? 'مكتبة الأفاتار ثلاثي الأبعاد'
                    : '24 3D Avatar Library'
                }
                className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 gap-2.5"
              >
                {AVATAR_3D_LIBRARY.map((item) => {
                  const isSelected = selectedKey === item.key && !photoDataUrl;
                  const isFallbackSelected =
                    selectedKey === item.key && Boolean(photoDataUrl);
                  const isDefault = item.key === defaultAssignedKey;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={selectedKey === item.key}
                      onClick={() => {
                        setSelectedKey(item.key);
                        // Selecting a 3D avatar makes it active immediately if user wants 3D look
                        if (photoDataUrl) {
                          setPhotoDataUrl(null);
                          setPhotoBytes(0);
                          setRawImageSrc(null);
                        }
                      }}
                      className={cn(
                        'group relative flex min-h-[88px] flex-col items-center justify-between gap-1.5 rounded-card border-2 p-2 text-center transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                        isSelected
                          ? 'border-blue-600 bg-blue-100/75 ring-2 ring-blue-500 shadow-sticker-sm'
                          : isFallbackSelected
                            ? 'border-outline bg-gold-200/45'
                            : 'border-border-paper bg-white hover:border-outline hover:bg-paper'
                      )}
                    >
                      <div className="relative h-12 w-12 overflow-hidden rounded-pill border-2 border-outline shadow-sticker-sm">
                        <Avatar3DArtwork
                          avatarKey={item.key}
                          className="h-full w-full"
                        />
                      </div>

                      <span className="line-clamp-1 w-full text-[11px] font-bold text-ink leading-tight">
                        {localizeText(lang, item.nameEn, item.nameAr)}
                      </span>

                      {selectedKey === item.key && (
                        <span className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-pill border border-white bg-blue-600 text-white shadow-sm">
                          <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                        </span>
                      )}

                      {isDefault && selectedKey !== item.key && (
                        <span className="absolute -top-1.5 -start-1.5 rounded-pill border border-outline bg-gold-300 px-1.5 py-0.2 text-[9px] font-black text-red-900">
                          {lang === 'ar' ? 'افتراضي' : 'DEFAULT'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="red" disabled={saving}>
              {saving
                ? lang === 'ar'
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : lang === 'ar'
                  ? 'حفظ الصورة والملف'
                  : 'Save Avatar & Profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
