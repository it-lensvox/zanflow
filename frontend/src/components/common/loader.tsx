import loaderGif from '@/public/assets/loader.gif';

const Loader = () => {
  return (
    <div className="zr-main-loader">
      <img src={loaderGif} alt="loading..." />
    </div>
  );
};

export default Loader;
