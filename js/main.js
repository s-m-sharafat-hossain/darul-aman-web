(function ($) {
  'use strict';

  // Spinner
  var spinner = function () {
    setTimeout(function () {
      if ($('#spinner').length > 0) {
        $('#spinner').removeClass('show');
      }
    }, 1);
  };
  spinner();

  // Initiate the wowjs
  new WOW().init();

  // ===============================
  // Header Carousel (single init)
  // ===============================
  $('.header-carousel').owlCarousel({
    items: 1,
    loop: true,
    autoplay: true,
    autoplayTimeout: 5000,
    smartSpeed: 1200,
    nav: true,
    dots: true,
    navText: [
      '<i class="bi bi-chevron-left"></i>',
      '<i class="bi bi-chevron-right"></i>'
    ]
  });

  // Modal Video
  $(document).ready(function () {
    var $videoSrc;
    $('.btn-play').click(function () {
      $videoSrc = $(this).data('src');
    });

    $('#videoModal').on('shown.bs.modal', function (e) {
      $('#video').attr(
        'src',
        $videoSrc + '?autoplay=1&amp;modestbranding=1&amp;showinfo=0'
      );
    });

    $('#videoModal').on('hide.bs.modal', function (e) {
      $('#video').attr('src', $videoSrc);
    });
  });

  // Facts counter
  $('[data-toggle="counter-up"]').counterUp({
    delay: 10,
    time: 2000,
  });

  // Donation progress
  $('.donation-item .donation-progress').waypoint(
    function () {
      $('.donation-item .progress .progress-bar').each(function () {
        $(this).css('height', $(this).attr('aria-valuenow') + '%');
      });
    },
    { offset: '80%' }
  );

  // Testimonials carousel
  $('.testimonial-carousel').owlCarousel({
    items: 1,
    autoplay: true,
    smartSpeed: 1000,
    animateIn: 'fadeIn',
    animateOut: 'fadeOut',
    dots: false,
    loop: true,
    nav: true,
    navText: [
      '<i class="bi bi-chevron-left"></i>',
      '<i class="bi bi-chevron-right"></i>',
    ],
  });
})(jQuery);
