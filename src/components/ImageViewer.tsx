interface ImageViewerProps {
  room: {
    id: string;
    room_name: string;
    current_image_url: string;
  } | undefined;
}

const ImageViewer = ({ room }: ImageViewerProps) => {
  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">No room selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
      <div className="max-w-full max-h-full">
        <img
          src={room.current_image_url}
          alt={room.room_name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-card"
        />
      </div>
    </div>
  );
};

export default ImageViewer;
