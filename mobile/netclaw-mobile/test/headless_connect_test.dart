import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:netclaw_mobile/ncfed/edge_client.dart';
import 'package:netclaw_mobile/ncfed/edge_identity.dart';
import 'package:netclaw_mobile/ncfed/enrollment_qr_payload.dart';
import 'package:netclaw_mobile/ncfed/enrollment_store.dart';
import 'package:netclaw_mobile/ncfed/headless_connect.dart';

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('headless_connect_test');
  });

  tearDown(() async {
    if (await tempDir.exists()) await tempDir.delete(recursive: true);
  });

  test('throws NotEnrolledError when no enrollment is stored', () async {
    expect(
      () => connectHeadless(directory: tempDir),
      throwsA(isA<NotEnrolledError>()),
    );
  });

  group('with a stored enrollment', () {
    setUp(() async {
      await EnrollmentStore(tempDir).save(
        const StoredEnrollment(
          memberId: 'phone-1',
          keyFingerprint: 'fp-abc',
          borderHost: 'border.example',
          borderPort: 8443,
          clawDomain: 'claw.example',
        ),
      );
    });

    test(
      'throws ConnectTimeoutError when the connect attempt never completes',
      () async {
        expect(
          () => connectHeadless(
            directory: tempDir,
            timeout: const Duration(milliseconds: 10),
            reconnect:
                (
                  EnrollmentQrPayload payload, {
                  required String memberId,
                  required String keyFingerprint,
                  required EdgeIdentity identity,
                }) => Completer<EdgeClient>().future, // never completes
          ),
          throwsA(isA<ConnectTimeoutError>()),
        );
      },
    );

    test(
      'owned headless work closes the client after intermediate failure',
      () async {
        final client = _FakeEdgeClient();
        await expectLater(
          withHeadlessClient<void>(
            (_) async {
              throw StateError('fixture persistence failed');
            },
            directory: tempDir,
            reconnect:
                (
                  payload, {
                  required memberId,
                  required keyFingerprint,
                  required identity,
                }) async => client,
          ),
          throwsStateError,
        );
        expect(client.closeCount, 1);
      },
    );

    test(
      'returns the connected client on success, passing the stored fields through',
      () async {
        late String seenMemberId;
        late String seenKeyFingerprint;
        final fakeClient = _FakeEdgeClient();
        final result = await connectHeadless(
          directory: tempDir,
          reconnect:
              (
                EnrollmentQrPayload payload, {
                required String memberId,
                required String keyFingerprint,
                required EdgeIdentity identity,
              }) async {
                seenMemberId = memberId;
                seenKeyFingerprint = keyFingerprint;
                return fakeClient;
              },
        );
        expect(result, same(fakeClient));
        expect(fakeClient.closeCount, 0);
        expect(seenMemberId, 'phone-1');
        expect(seenKeyFingerprint, 'fp-abc');
      },
    );

    test('closes a client that connects after the caller timed out', () async {
      final pending = Completer<EdgeClient>();
      final client = _FakeEdgeClient();
      final result = connectHeadless(
        directory: tempDir,
        timeout: const Duration(milliseconds: 10),
        reconnect:
            (
              payload, {
              required memberId,
              required keyFingerprint,
              required identity,
            }) => pending.future,
      );
      await expectLater(result, throwsA(isA<ConnectTimeoutError>()));
      pending.complete(client);
      await Future<void>.delayed(Duration.zero);
      expect(client.closeCount, 1);
    });

    test('rethrows a non-timeout connect failure as-is', () async {
      expect(
        () => connectHeadless(
          directory: tempDir,
          reconnect:
              (
                EnrollmentQrPayload payload, {
                required String memberId,
                required String keyFingerprint,
                required EdgeIdentity identity,
              }) => Future<EdgeClient>.error(
                EdgeClientException('-32023', 'revoked'),
              ),
        ),
        throwsA(isA<EdgeClientException>()),
      );
    });
  });
}

class _FakeEdgeClient implements EdgeClient {
  int closeCount = 0;
  @override
  Future<void> close() async {
    closeCount++;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
