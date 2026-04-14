import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'package:video_player/video_player.dart';

// ─────────────────────────────────────────────
// CHANGE THIS to your local machine's IP address
// Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
// to find it. Use the IPv4 address, e.g. 192.168.1.5
// Do NOT use localhost or 127.0.0.1 on a real device.
// ─────────────────────────────────────────────
const String BASE_URL = 'http://192.168.1.9';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Cheer Highlight Reel',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const VideoUploadPage(),
    );
  }
}

class VideoUploadPage extends StatefulWidget {
  const VideoUploadPage({super.key});

  @override
  State<VideoUploadPage> createState() => _VideoUploadPageState();
}

class _VideoUploadPageState extends State<VideoUploadPage> {
  VideoPlayerController? _controller;

  // State tracking
  bool _isUploading = false;
  bool _isProcessing = false;
  bool _isVideoReady = false;
  String _statusMessage = 'Pick a video to get started';
  String? _downloadUrl;
  double _uploadProgress = 0.0;

  // ─── Pick video from gallery ───────────────────────────────────────────────
  Future<void> _pickVideo() async {
    // Prevent picking while already processing
    if (_isUploading || _isProcessing) return;

    final ImagePicker picker = ImagePicker();
    final XFile? video = await picker.pickVideo(source: ImageSource.gallery);

    if (video == null) return; // User cancelled

    // Reset state for new upload
    setState(() {
      _isVideoReady = false;
      _downloadUrl = null;
      _controller?.dispose();
      _controller = null;
      _uploadProgress = 0.0;
    });

    await _uploadVideo(File(video.path));
  }

  // ─── Upload video to FastAPI backend ───────────────────────────────────────
  Future<void> _uploadVideo(File videoFile) async {
    setState(() {
      _isUploading = true;
      _statusMessage = 'Uploading video...';
    });

    try {
      // Build multipart request
      // FastAPI endpoint: POST /process
      // FastAPI field name: "file"
      final uri = Uri.parse('$BASE_URL/process');
      final request = http.MultipartRequest('POST', uri);

      request.files.add(
        await http.MultipartFile.fromPath(
          'file', // Must match FastAPI: file: UploadFile = File(...)
          videoFile.path,
        ),
      );

      // Send and wait for job_id response
      final streamedResponse = await request.send().timeout(
        const Duration(seconds: 60),
        onTimeout: () => throw TimeoutException('Upload timed out'),
      );

      final responseBody = await streamedResponse.stream.bytesToString();

      if (streamedResponse.statusCode != 200) {
        throw Exception('Upload failed: ${streamedResponse.statusCode}\n$responseBody');
      }

      final Map<String, dynamic> data = jsonDecode(responseBody);
      final String jobId = data['job_id'];

      setState(() {
        _isUploading = false;
        _isProcessing = true;
        _statusMessage = 'Analyzing audio for cheers...';
      });

      // FastAPI processes asynchronously — poll for result
      await _pollForResult(jobId);

    } on TimeoutException {
      _setError('Upload timed out. Is the server running?');
    } on SocketException {
      _setError('Cannot reach server at $BASE_URL\nCheck your IP address and that the server is running.');
    } catch (e) {
      _setError('Error: $e');
    }
  }

  // ─── Poll /status/{job_id} until done ─────────────────────────────────────
  Future<void> _pollForResult(String jobId) async {
    const maxAttempts = 120; // 2 minutes max (polling every second)
    int attempts = 0;

    while (attempts < maxAttempts) {
      await Future.delayed(const Duration(seconds: 2));
      attempts++;

      try {
        final response = await http.get(
          Uri.parse('$BASE_URL/status/$jobId'),
        ).timeout(const Duration(seconds: 10));

        if (response.statusCode != 200) continue;

        final Map<String, dynamic> data = jsonDecode(response.body);
        final String status = data['status'];

        if (status == 'processing') {
          // Still working — update UI dots for feedback
          setState(() {
            _statusMessage = 'Analyzing audio for cheers${'.' * (attempts % 4)}';
          });
          continue;
        }

        if (status == 'error') {
          _setError('Processing failed: ${data['message']}');
          return;
        }

        if (status == 'success') {
          final String downloadPath = data['download_url'];
          final String fullUrl = '$BASE_URL$downloadPath';

          setState(() {
            _isProcessing = false;
            _isVideoReady = true;
            _downloadUrl = fullUrl;
            _statusMessage = 'Highlight reel is ready!';
          });

          await _initVideoPlayer(fullUrl);
          return;
        }

      } catch (_) {
        // Network hiccup — keep retrying
        continue;
      }
    }

    _setError('Processing timed out. The video may be too long.');
  }

  // ─── Load and auto-play the result video ──────────────────────────────────
  Future<void> _initVideoPlayer(String url) async {
    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    await controller.initialize();
    controller.setLooping(true);
    controller.play();

    setState(() {
      _controller = controller;
    });
  }

  // ─── Shared error handler ─────────────────────────────────────────────────
  void _setError(String message) {
    setState(() {
      _isUploading = false;
      _isProcessing = false;
      _statusMessage = message;
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  // ─── Build UI ─────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final bool isBusy = _isUploading || _isProcessing;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: const Text('Cheer Highlight Reel'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Video preview ────────────────────────────────────────────────
            if (_controller != null && _controller!.value.isInitialized)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: _controller!.value.aspectRatio,
                  child: VideoPlayer(_controller!),
                ),
              )
            else
              Container(
                height: 220,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                  child: Icon(Icons.videocam_outlined, size: 64, color: Colors.grey),
                ),
              ),

            const SizedBox(height: 24),

            // ── Status message ───────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _isVideoReady
                    ? Colors.green[50]
                    : _statusMessage.startsWith('Error') || _statusMessage.startsWith('Cannot')
                        ? Colors.red[50]
                        : Colors.blue[50],
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  if (isBusy)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    Icon(
                      _isVideoReady
                          ? Icons.check_circle
                          : _statusMessage.startsWith('Error') || _statusMessage.startsWith('Cannot')
                              ? Icons.error_outline
                              : Icons.info_outline,
                      color: _isVideoReady
                          ? Colors.green
                          : _statusMessage.startsWith('Error') || _statusMessage.startsWith('Cannot')
                              ? Colors.red
                              : Colors.blue,
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _statusMessage,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── Pick video button ────────────────────────────────────────────
            ElevatedButton.icon(
              onPressed: isBusy ? null : _pickVideo,
              icon: const Icon(Icons.video_library),
              label: Text(isBusy ? 'Processing...' : 'Pick Video from Gallery'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                textStyle: const TextStyle(fontSize: 16),
              ),
            ),

            // ── Download / play controls ─────────────────────────────────────
            if (_isVideoReady && _downloadUrl != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        if (_controller?.value.isPlaying == true) {
                          _controller?.pause();
                        } else {
                          _controller?.play();
                        }
                        setState(() {});
                      },
                      icon: Icon(
                        _controller?.value.isPlaying == true
                            ? Icons.pause
                            : Icons.play_arrow,
                      ),
                      label: Text(
                        _controller?.value.isPlaying == true ? 'Pause' : 'Play',
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickVideo,
                      icon: const Icon(Icons.refresh),
                      label: const Text('New Video'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Download URL: $_downloadUrl',
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
            ],

            const SizedBox(height: 32),

            // ── Debug info ───────────────────────────────────────────────────
            Text(
              'Server: $BASE_URL',
              style: TextStyle(fontSize: 11, color: Colors.grey[400]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
