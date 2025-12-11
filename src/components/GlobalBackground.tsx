const GlobalBackground = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-black">
      {/* Blob 1 - Dark Blue Primary */}
      <div 
        className="absolute top-0 left-0 w-[50vw] h-[50vw] bg-[#0E4272]/30 blur-[100px] rounded-full mix-blend-screen opacity-70 animate-blob-1"
      />
    
      {/* Blob 2 - Dark Blue Secondary */}
      <div 
        className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#0E4272]/20 blur-[100px] rounded-full mix-blend-screen opacity-70 animate-blob-2"
      />

      {/* Blob 3 - Dark Blue Accent */}
      <div 
        className="absolute bottom-0 left-0 w-[45vw] h-[45vw] bg-[#0E4272]/30 blur-[100px] rounded-full mix-blend-screen opacity-70 animate-blob-3"
      />

      {/* Blob 4 - Pink Accent */}
      <div 
        className="absolute bottom-0 right-0 w-[35vw] h-[35vw] bg-[#F69292]/20 blur-[100px] rounded-full mix-blend-screen opacity-70 animate-blob-4"
      />
    </div>
  );
};

export default GlobalBackground;
